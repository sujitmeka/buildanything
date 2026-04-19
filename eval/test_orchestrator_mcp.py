#!/usr/bin/env python3
"""Regression eval for the orchestrator stdio MCP server.

Pins the manifest -> executable -> MCP surface contract that broke in the
pre-2.0 ship where orchestrator tools were registered in-process and then
discarded, so Claude Code hosts never saw them. Every callsite of state_save
against .build-state.json tripped the PreToolUse deny and the whole plugin
wedged on Phase 1.

These tests do NOT import plugin code. They spawn the server exactly like
Claude Code will, speak raw MCP JSON-RPC 2.0 over stdio, and assert on
observable behaviour.
"""
from __future__ import annotations

import hashlib
import json
import os
import signal
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parent.parent
PLUGIN_JSON = ROOT / ".claude-plugin" / "plugin.json"
SERVER_TS = ROOT / "bin" / "mcp-servers" / "orchestrator-mcp.ts"

EXPECTED_TOOLS: frozenset[str] = frozenset(
    {
        "state_save",
        "state_read",
        "verify_integrity",
        "acquire_write_lease",
        "release_write_lease",
        "list_write_leases",
        "cycle_counter_check",
        "clear_in_flight_edge",
        "handle_stale_edge",
        "scribe_decision",
    }
)

SUBPROCESS_TIMEOUT_SEC = 15


# ---------------------------------------------------------------------------
# Helpers — manifest resolution + MCP JSON-RPC client
# ---------------------------------------------------------------------------


def _resolve_server_command() -> Path:
    """Read plugin.json, expand ${CLAUDE_PLUGIN_ROOT}, return the server path.

    Mirrors what a Claude Code host does when it spins the MCP server up.
    """
    manifest = json.loads(PLUGIN_JSON.read_text())
    mcp_servers = manifest.get("mcpServers", {})
    orchestrator = mcp_servers.get("orchestrator")
    assert orchestrator is not None, "plugin.json missing mcpServers.orchestrator"
    command = orchestrator.get("command")
    assert isinstance(command, str) and command, (
        "mcpServers.orchestrator.command must be a non-empty string"
    )
    expanded = command.replace("${CLAUDE_PLUGIN_ROOT}", str(ROOT))
    return Path(expanded)


def _mcp_exchange(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Spawn the server, send newline-delimited JSON-RPC, collect matching
    responses by id, close stdin so the server shuts down, return ordered
    responses aligned with ``requests``.
    """
    server_path = _resolve_server_command()
    assert server_path.exists(), f"server command not found on disk: {server_path}"
    assert os.access(server_path, os.X_OK), (
        f"server command is not executable: {server_path}"
    )

    stdin_blob = "".join(json.dumps(req) + "\n" for req in requests)
    wanted_ids = {req["id"] for req in requests}

    proc = subprocess.Popen(
        [str(server_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(ROOT),
        text=True,
    )
    try:
        stdout, stderr = proc.communicate(
            input=stdin_blob, timeout=SUBPROCESS_TIMEOUT_SEC
        )
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()
        pytest.fail(
            f"orchestrator MCP server hung (>{SUBPROCESS_TIMEOUT_SEC}s). "
            f"stderr so far: {proc.stderr.read() if proc.stderr else ''!r}"
        )

    if proc.returncode not in (0, -signal.SIGPIPE):
        pytest.fail(
            f"orchestrator MCP server exited with rc={proc.returncode}.\n"
            f"stderr:\n{stderr}"
        )

    by_id: dict[Any, dict[str, Any]] = {}
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            frame = json.loads(line)
        except json.JSONDecodeError:
            continue
        frame_id = frame.get("id")
        if frame_id in wanted_ids:
            by_id[frame_id] = frame

    missing = wanted_ids - by_id.keys()
    assert not missing, (
        f"no response frames for ids {sorted(missing)}. "
        f"raw stdout:\n{stdout}\nstderr:\n{stderr}"
    )
    return [by_id[req["id"]] for req in requests]


def _initialize() -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "eval", "version": "1"},
        },
    }


def _list_tools(req_id: int = 2) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "method": "tools/list"}


def _call_tool(req_id: int, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }


def _parse_tool_payload(response: dict[str, Any]) -> dict[str, Any]:
    """tools/call wraps handler output in result.content[0].text as JSON."""
    assert "result" in response, f"expected result frame, got: {response}"
    content = response["result"].get("content")
    assert isinstance(content, list) and content, (
        f"result.content must be a non-empty list: {response}"
    )
    first = content[0]
    assert first.get("type") == "text", f"expected text content, got: {first}"
    return json.loads(first["text"])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_manifest_points_to_existing_executable() -> None:
    """plugin.json -> mcpServers.orchestrator.command must resolve to a real
    executable file. This is the step the pre-2.0 build skipped entirely.
    """
    server_path = _resolve_server_command()
    assert server_path.exists(), (
        f"mcpServers.orchestrator.command does not exist on disk: {server_path}"
    )
    assert server_path.is_file(), f"expected a file, got: {server_path}"
    assert os.access(server_path, os.X_OK), (
        f"server command is not executable (chmod +x needed): {server_path}"
    )


@pytest.mark.integration
def test_tools_list_exposes_exactly_the_ten_orchestrator_tools() -> None:
    """A real MCP handshake + tools/list must return exactly the 10 tools the
    orchestrator contracts with. Catches 'server boots but registers nothing',
    'extra tool accidentally shipped', and 'tool renamed without updating
    callers'.
    """
    init_resp, list_resp = _mcp_exchange([_initialize(), _list_tools()])

    assert "result" in init_resp, f"initialize failed: {init_resp}"
    server_info = init_resp["result"].get("serverInfo", {})
    assert server_info.get("name") == "buildanything-orchestrator", (
        f"unexpected serverInfo: {server_info}"
    )

    tools = list_resp.get("result", {}).get("tools")
    assert isinstance(tools, list), f"tools/list missing tools array: {list_resp}"

    got = {t["name"] for t in tools}
    missing = EXPECTED_TOOLS - got
    extra = got - EXPECTED_TOOLS
    assert not missing and not extra, (
        f"tools/list surface drift. missing={sorted(missing)} extra={sorted(extra)}"
    )
    assert len(tools) == len(EXPECTED_TOOLS), (
        f"duplicate tool names: {[t['name'] for t in tools]}"
    )


@pytest.mark.integration
def test_state_save_actually_writes_file_atomically() -> None:
    """tools/call state_save must produce a file on disk whose SHA-256 matches
    the server's response. This is the exact call that was dead-on-arrival
    before the stdio server was wired up.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        target = Path(tmpdir) / "build-state.json"
        state = {
            "hello": "world",
            "n": 42,
            "nested": {"phase": "P1", "agents": ["a", "b"]},
        }
        _init_resp, call_resp = _mcp_exchange(
            [
                _initialize(),
                _call_tool(3, "state_save", {"path": str(target), "state": state}),
            ]
        )

        assert call_resp.get("result", {}).get("isError") is not True, (
            f"state_save returned an error frame: {call_resp}"
        )

        payload = _parse_tool_payload(call_resp)
        assert payload.get("success") is True, f"state_save payload: {payload}"
        server_sha = payload.get("sha256")
        assert isinstance(server_sha, str) and len(server_sha) == 64, (
            f"sha256 missing/malformed: {payload}"
        )

        assert target.exists(), f"state file not on disk after state_save: {target}"
        disk_bytes = target.read_bytes()
        disk_sha = hashlib.sha256(disk_bytes).hexdigest()
        assert disk_sha == server_sha, (
            f"on-disk SHA {disk_sha} does not match server-reported {server_sha}"
        )
        assert payload.get("bytesWritten") == len(disk_bytes), (
            f"bytesWritten {payload.get('bytesWritten')} != disk length {len(disk_bytes)}"
        )

        reparsed = json.loads(disk_bytes.decode("utf-8"))
        assert reparsed == state, (
            f"round-trip mismatch: wrote {state!r}, read {reparsed!r}"
        )


@pytest.mark.integration
def test_tools_list_matches_server_source_of_truth() -> None:
    """The TS source file registers each tool with ``server.registerTool(
    "name", ...)``. The names surfaced over stdio must be exactly the set of
    names registered in that file — it is the single source of truth and any
    drift is a shipping bug.
    """
    src = SERVER_TS.read_text()
    registered: list[str] = []
    needle = 'server.registerTool(\n    "'
    start = 0
    while True:
        idx = src.find(needle, start)
        if idx == -1:
            break
        name_start = idx + len(needle)
        name_end = src.find('"', name_start)
        assert name_end != -1, f"unterminated tool name in {SERVER_TS}"
        registered.append(src[name_start:name_end])
        start = name_end

    assert registered, (
        f"no server.registerTool calls found in {SERVER_TS}; parse heuristic broke"
    )
    assert len(registered) == len(set(registered)), (
        f"duplicate registerTool names in source: {registered}"
    )

    _init_resp, list_resp = _mcp_exchange([_initialize(), _list_tools()])
    runtime_names = {t["name"] for t in list_resp["result"]["tools"]}

    assert set(registered) == runtime_names, (
        f"registerTool names in source {sorted(registered)} "
        f"disagree with runtime tools/list {sorted(runtime_names)}"
    )
