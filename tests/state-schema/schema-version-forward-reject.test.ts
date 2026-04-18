import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSchemaVersion } from '../../bin/buildanything-runtime.ts';

const MAX = 2;
const PATH = '/tmp/fixture/.build-state.json';

describe('schema version forward-reject (A7, task 4.5.2)', () => {
  // (a) schema_version at the current max — pass.
  it('(a) schema_version === max_supported is accepted', () => {
    const res = checkSchemaVersion({ schema_version: 2 }, MAX, PATH);
    assert.equal(res.accepted, true);
  });

  // (b) schema_version above the max — reject with a message that names the
  // path, both versions, and the remediation.
  it('(b) schema_version > max_supported is rejected', () => {
    const res = checkSchemaVersion({ schema_version: 3 }, MAX, PATH);
    assert.equal(res.accepted, false);
    assert.equal(res.reason, 'too_new');
    assert.equal(res.detected, 3);
    assert.equal(res.max, 2);
    assert.ok(res.message?.includes('schema_version=3'));
    assert.ok(res.message?.includes('supported maximum 2'));
    assert.ok(res.message?.includes(PATH));
    assert.ok(res.message?.includes('Upgrade plugin to >=v3'));
    assert.ok(res.message?.includes('delete the state file'));
  });

  // (c) schema_version missing entirely — pass (fresh or pre-v1 file).
  it('(c) missing schema_version is accepted', () => {
    assert.equal(checkSchemaVersion({}, MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion({ phase: 3 }, MAX, PATH).accepted, true);
  });

  // (d) Malformed / non-object state — this helper should accept; runtime-level
  // parse failures are handled by the caller (a warning is logged and parse is
  // set to null, which also routes through the "accepted" branch here).
  it('(d) malformed / non-object state is accepted (upstream handles parse)', () => {
    assert.equal(checkSchemaVersion(null, MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion(undefined, MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion('not-an-object', MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion(42, MAX, PATH).accepted, true);
  });

  it('non-numeric schema_version is treated as missing (accepted)', () => {
    assert.equal(checkSchemaVersion({ schema_version: 'two' }, MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion({ schema_version: null }, MAX, PATH).accepted, true);
    assert.equal(checkSchemaVersion({ schema_version: NaN }, MAX, PATH).accepted, true);
  });

  it('lower schema_version is accepted (upgrade/migration is out of scope)', () => {
    assert.equal(checkSchemaVersion({ schema_version: 1 }, MAX, PATH).accepted, true);
  });
});
