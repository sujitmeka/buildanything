import { describe, it } from "node:test";
import assert from "node:assert/strict";
import semver from "semver";

const HOST_RANGE = ">=1.5.0 <3.0.0";

function checkHostCompat(version: string | undefined, range: string) {
  if (version === undefined) return { compatible: true, reason: "no-op: host version not exposed" };
  return semver.satisfies(version, range)
    ? { compatible: true, reason: "host version in range" }
    : { compatible: false, reason: `host ${version} outside ${range}, falling back to markdown` };
}

describe("sdk-host-compat", () => {
  it("version in range passes", () => {
    assert.ok(semver.satisfies("2.0.0", HOST_RANGE));
    assert.deepStrictEqual(checkHostCompat("2.0.0", HOST_RANGE).compatible, true);
  });

  it("version below range triggers fallback", () => {
    assert.equal(semver.satisfies("1.4.9", HOST_RANGE), false);
    assert.equal(checkHostCompat("1.4.9", HOST_RANGE).compatible, false);
  });

  it("version above range triggers fallback", () => {
    assert.equal(semver.satisfies("3.0.0", HOST_RANGE), false);
    assert.equal(checkHostCompat("3.0.0", HOST_RANGE).compatible, false);
  });

  it("missing CLAUDE_CODE_VERSION no-ops gracefully", () => {
    delete process.env.CLAUDE_CODE_VERSION;
    const result = checkHostCompat(undefined, HOST_RANGE);
    assert.equal(result.compatible, true);
    assert.equal(result.reason, "no-op: host version not exposed");
  });
});
