import { describe, expect, it } from 'vitest';
import { checkAgainstAnchor } from './RecordParts.jsx';

const events = [{ seq: 1, hash: 'h1' }, { seq: 2, hash: 'h2' }, { seq: 3, hash: 'h3' }];
const anchor = { generatedAt: '2026-10-08T06:17:00Z', heads: [{ ledgerId: 'L', seq: 2, headHash: 'h2' }] };

describe('checkAgainstAnchor', () => {
  it('confirms history up to the anchored entry', () => {
    expect(checkAgainstAnchor(anchor, 'L', events)).toMatchObject({ status: 'anchored', seq: 2 });
  });
  it('flags rewritten or truncated history', () => {
    expect(checkAgainstAnchor(anchor, 'L', [{ seq: 1, hash: 'h1' }, { seq: 2, hash: 'forged' }])).toMatchObject({ status: 'mismatch' });
    expect(checkAgainstAnchor(anchor, 'L', [{ seq: 1, hash: 'h1' }])).toMatchObject({ status: 'mismatch' });
  });
  it('says nothing for ledgers not anchored yet', () => {
    expect(checkAgainstAnchor(anchor, 'other', events)).toEqual({ status: 'not_anchored' });
  });
});
