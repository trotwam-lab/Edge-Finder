import { describe, expect, it } from 'vitest';
import { isEmailTrusted, EMAIL_TRUST_CUTOFF } from './_auth.js';

const before = () => Promise.resolve(EMAIL_TRUST_CUTOFF - 1000);
const after = () => Promise.resolve(EMAIL_TRUST_CUTOFF + 1000);
const noLegacyUids = new Set();

describe('isEmailTrusted', () => {
  it('trusts verified emails', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: true }, { lookupCreatedAt: after })).toBe(true);
  });

  it('keeps existing unverified accounts working', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: false }, { lookupCreatedAt: before, legacyProUids: noLegacyUids })).toBe(true);
  });

  it('keeps migrated legacy Pro accounts working when Admin lookup is unavailable', async () => {
    expect(await isEmailTrusted(
      { uid: 'legacy-user', email: 'friend@example.com', email_verified: false },
      { lookupCreatedAt: () => Promise.resolve(undefined), legacyProUids: new Set(['legacy-user']) },
    )).toBe(true);
  });

  it('does not let a different uid claim a migrated legacy grant', async () => {
    expect(await isEmailTrusted(
      { uid: 'attacker', email: 'friend@example.com', email_verified: false },
      { lookupCreatedAt: () => Promise.resolve(undefined), legacyProUids: new Set(['legacy-user']) },
    )).toBe(false);
  });

  it('rejects unverified accounts created after the cutoff', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: false }, { lookupCreatedAt: after, legacyProUids: noLegacyUids })).toBe(false);
  });

  it('fails closed when creation time cannot be looked up', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c' }, { lookupCreatedAt: () => Promise.resolve(undefined), legacyProUids: noLegacyUids })).toBe(false);
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c' }, { lookupCreatedAt: () => Promise.reject(new Error('x')), legacyProUids: noLegacyUids })).toBe(false);
  });

  it('never trusts a missing email', async () => {
    expect(await isEmailTrusted({ uid: 'u', email_verified: true })).toBe(false);
  });
});
