import { describe, expect, it } from 'vitest';
import { freeName } from './downloads';

describe('freeName', () => {
  it('keeps a name that is free', () => {
    expect(freeName('report.pdf', () => false)).toBe('report.pdf');
  });

  it('numbers a name that is taken, before its extension', () => {
    const taken = new Set(['report.pdf', 'report (1).pdf']);

    expect(freeName('report.pdf', (each) => taken.has(each))).toBe(
      'report (2).pdf',
    );
  });

  it('keeps a download inside the Downloads folder', () => {
    expect(freeName('../../etc/passwd', () => false)).toBe('passwd');
    expect(freeName('', () => false)).toBe('download');
  });
});
