import {describe,expect,it} from 'vitest';
import {canonicalMessage,sha256} from '../src/canonical.js';

describe('canonical challenge',()=>{
  it('is deterministic and binds content hashes',()=>{
    const message={domain:'dao-api.flon.network',purpose:'create-governance-discussion' as const,account:'alice',permission:'active',chain_id:'a'.repeat(64),title_hash:sha256('Title'),body_hash:sha256('Body'),nonce:'nonce',issued_at:'2026-10-27T00:00:00.000Z',expires_at:'2026-10-27T00:05:00.000Z'};
    const value=canonicalMessage(message);
    expect(value).toContain('account:alice');
    expect(value).toContain(`title_hash:${sha256('Title')}`);
    expect(canonicalMessage(message)).toBe(value);
  });
});
