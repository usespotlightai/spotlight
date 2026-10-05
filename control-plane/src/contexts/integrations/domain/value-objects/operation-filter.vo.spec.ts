import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { describe, expect, it } from 'vitest';

describe('OperationFilter', () => {
  it('lets everything through when it names nothing', () => {
    expect(OperationFilter.of({}).admits('delete-pet')).toBe(true);
  });

  it('lets through what it includes, less what it excludes', () => {
    const filter = OperationFilter.of({
      include: ['*pet*', 'get-inventory'],
      exclude: ['delete-*'],
    });

    expect(filter.admits('find-pets-by-status')).toBe(true);
    expect(filter.admits('get-inventory')).toBe(true);
    expect(filter.admits('delete-pet')).toBe(false);
    expect(filter.admits('get-order')).toBe(false);
  });

  it('matches a whole name, with * standing for any run of letters', () => {
    expect(OperationFilter.of({ include: ['pet'] }).admits('get-pet')).toBe(
      false,
    );
    expect(OperationFilter.of({ include: ['*pet'] }).admits('get-pet')).toBe(
      true,
    );
  });

  it('refuses a pattern that could never match a tool name', () => {
    expect(() => OperationFilter.of({ include: ['Pet.*'] })).toThrow(
      /lowercase words joined by dashes/,
    );
  });
});
