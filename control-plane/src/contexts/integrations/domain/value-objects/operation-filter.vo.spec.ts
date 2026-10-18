import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { describe, expect, it } from 'vitest';

describe('OperationFilter', () => {
  it('lets everything through when it names nothing', () => {
    expect(OperationFilter.of({}).matches('delete-pet')).toBe(true);
  });

  it('lets through what it includes, less what it excludes', () => {
    const filter = OperationFilter.of({
      include: ['*pet*', 'get-inventory'],
      exclude: ['delete-*'],
    });

    expect(filter.matches('find-pets-by-status')).toBe(true);
    expect(filter.matches('get-inventory')).toBe(true);
    expect(filter.matches('delete-pet')).toBe(false);
    expect(filter.matches('get-order')).toBe(false);
  });

  it('matches a whole name, where * matches any run of letters', () => {
    expect(OperationFilter.of({ include: ['pet'] }).matches('get-pet')).toBe(
      false,
    );
    expect(OperationFilter.of({ include: ['*pet'] }).matches('get-pet')).toBe(
      true,
    );
  });

  it('rejects a pattern that could never match a tool name', () => {
    expect(() => OperationFilter.of({ include: ['Pet.*'] })).toThrow(
      /lowercase words joined by dashes/,
    );
  });
});
