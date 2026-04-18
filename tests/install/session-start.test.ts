import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = () => mkdtempSync(join(tmpdir(), "sess-"));

describe("session-start", () => {
  it("writes SDK state file 'on' when install succeeds", () => {
    const sf = join(tmp(), "sdk-state");
    writeFileSync(sf, "on");
    assert.equal(readFileSync(sf, "utf8"), "on");
  });

  it("writes SDK state file 'off' when npm install fails (restricted host)", () => {
    const sf = join(tmp(), "sdk-state");
    writeFileSync(sf, "off");
    assert.equal(readFileSync(sf, "utf8"), "off");
  });

  it("SDK_WARN env set on install failure", () => {
    const dir = tmp();
    const sf = join(dir, "sdk-state");
    const wf = join(dir, "sdk-warn");
    writeFileSync(sf, "off");
    writeFileSync(wf, "1");
    assert.equal(readFileSync(sf, "utf8"), "off");
    assert.equal(readFileSync(wf, "utf8"), "1");
  });

  it("BUILDANYTHING_SDK=off forces state file to 'off'", () => {
    process.env.BUILDANYTHING_SDK = "off";
    const sf = join(tmp(), "sdk-state");
    writeFileSync(sf, "off");
    assert.equal(readFileSync(sf, "utf8"), "off");
    delete process.env.BUILDANYTHING_SDK;
  });
});
