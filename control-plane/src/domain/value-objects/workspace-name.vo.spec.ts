import { InvalidWorkspaceNameError } from '@domain/exceptions/invalid-workspace-name.error';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { describe, expect, it } from 'vitest';

describe('WorkspaceName', () => {
  it('trims surrounding whitespace', () => {
    expect(WorkspaceName.of('  Acme Inc.  ').value).toBe('Acme Inc.');
  });

  it('rejects a blank name', () => {
    expect(() => WorkspaceName.of('   ')).toThrow(InvalidWorkspaceNameError);
  });

  it('rejects a name over 100 characters', () => {
    expect(() => WorkspaceName.of('a'.repeat(101))).toThrow(
      InvalidWorkspaceNameError,
    );
  });
});
