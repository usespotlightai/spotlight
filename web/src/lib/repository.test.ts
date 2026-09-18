import { describe, expect, it } from 'vitest';
import { fullNameOf, nameUnder } from '@/lib/repository';

describe('nameUnder', () => {
  it('leaves off the owner already shown', () => {
    expect(nameUnder('acme', 'acme/api')).toBe('api');
  });

  it('is nothing for a repository under another owner', () => {
    expect(nameUnder('acme', 'globex/api')).toBeNull();
  });

  it('is the whole name where no owner is shown', () => {
    expect(nameUnder(null, 'acme/api')).toBe('acme/api');
  });
});

describe('fullNameOf', () => {
  it('puts the owner shown in front of the name typed', () => {
    expect(fullNameOf('acme', ' api ')).toBe('acme/api');
  });

  it('is what was typed where no owner is shown', () => {
    expect(fullNameOf(null, 'acme/api')).toBe('acme/api');
  });

  it('is empty where nothing was typed', () => {
    expect(fullNameOf('acme', '  ')).toBe('');
  });
});
