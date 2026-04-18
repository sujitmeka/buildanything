import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function checkSchemaVersion(version: number | undefined, maxSupported: number) {
  const v = version && version > 0 ? version : 1;
  if (v > maxSupported) return { accepted: false, message: 'This build state was produced by a newer plugin version. Please upgrade.' };
  return { accepted: true };
}

describe('schema version forward-reject (A7)', () => {
  it('schema version 1 accepted by Stage 1 binary', () => {
    assert.equal(checkSchemaVersion(1, 1).accepted, true);
  });

  it('schema version 2 rejected by Stage 1 binary (max_supported=1)', () => {
    const res = checkSchemaVersion(2, 1);
    assert.equal(res.accepted, false);
    assert.ok(res.message?.includes('newer plugin version'));
  });

  it('schema version equal to max_supported is accepted', () => {
    assert.equal(checkSchemaVersion(2, 2).accepted, true);
  });

  it('schema version 0 or missing defaults to 1', () => {
    assert.equal(checkSchemaVersion(undefined, 1).accepted, true);
    assert.equal(checkSchemaVersion(0, 1).accepted, true);
  });
});
