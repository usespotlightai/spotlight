import {
  graphqlOperationWrites,
  httpOperationWrites,
  mcpToolWrites,
} from '@integrations/domain/services/operation-writes';
import { describe, expect, it } from 'vitest';

describe('mcpToolWrites', () => {
  it('takes a tool the server says only reads at its word', () => {
    expect(mcpToolWrites({ readOnlyHint: true })).toBe(false);
  });

  it('takes a tool the server says destroys data as writing', () => {
    expect(mcpToolWrites({ destructiveHint: true })).toBe(true);
    expect(mcpToolWrites({ readOnlyHint: true, destructiveHint: true })).toBe(
      true,
    );
  });

  it('takes a tool the server says nothing about as writing', () => {
    expect(mcpToolWrites(undefined)).toBe(true);
    expect(mcpToolWrites({})).toBe(true);
    expect(mcpToolWrites({ readOnlyHint: 'yes' })).toBe(true);
  });

  it('takes a tool that only adds as writing', () => {
    expect(mcpToolWrites({ readOnlyHint: false, destructiveHint: false })).toBe(
      true,
    );
  });
});

describe('httpOperationWrites', () => {
  it('takes a method that changes data as writing, and one that reads as reading', () => {
    expect(
      ['POST', 'PUT', 'PATCH', 'DELETE'].every((method) =>
        httpOperationWrites(method as 'POST'),
      ),
    ).toBe(true);
    expect(httpOperationWrites('GET')).toBe(false);
    expect(httpOperationWrites('HEAD')).toBe(false);
  });
});

describe('graphqlOperationWrites', () => {
  it('takes a mutation as writing, and a query as reading', () => {
    expect(graphqlOperationWrites('mutation')).toBe(true);
    expect(graphqlOperationWrites('query')).toBe(false);
  });
});
