import { describe, expect, it } from 'vitest';
import { validShareToken } from './sharing';

describe('read-only share capability validation', () => {
  it('accepts a complete random UUID capability', () => {
    expect(validShareToken('f2bfe7c5-390c-49e5-8930-3a34c6a8a06d')).toBe(true);
  });
  it('rejects an incomplete or injected link token', () => {
    expect(validShareToken('f2bfe7c5')).toBe(false);
    expect(validShareToken("' OR true--")).toBe(false);
  });
});