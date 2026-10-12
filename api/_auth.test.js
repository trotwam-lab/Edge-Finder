import { describe, expect, it } from 'vitest';
import { isEmailTrusted, EMAIL_TRUST_CUTOFF } from './_auth.js';

const before = () => Promise.resolve(EMAIL_TRUST_CUTOFF - 1000);
const after = () => Promise.resolve(EMAIL_TRUST_CUTOFF + 1000);

describe('isEmailTrusted', () => {
  it('trusts verified emails', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: true }, { lookupCreatedAt: after })).toBe(true);
  });

  it('keeps existing unverified accounts working', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: false }, { lookupCreatedAt: before })).toBe(true);
  });

  it('rejects unverified accounts created after the cutoff', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c', email_verified: false }, { lookupCreatedAt: after })).toBe(false);
  });

  it('fails closed when creation time cannot be looked up', async () => {
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c' }, { lookupCreatedAt: () => Promise.resolve(undefined) })).toBe(false);
    expect(await isEmailTrusted({ uid: 'u', email: 'a@b.c' }, { lookupCreatedAt: () => Promise.reject(new Error('x')) })).toBe(false);
  });

  it('never trusts a missing email', async () => {
    expect(await isEmailTrusted({ uid: 'u', email_verified: true })).toBe(false);
  });
});
