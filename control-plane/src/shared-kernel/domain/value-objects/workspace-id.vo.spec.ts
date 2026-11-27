import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

interface Comparable {
  equals(other: unknown): boolean;
}

describe('identifiers', () => {
  it('compare by value within one kind', () => {
    expect(WorkspaceId.of('a').equals(WorkspaceId.of('a'))).toBe(true);
    expect(WorkspaceId.of('a').equals(WorkspaceId.of('b'))).toBe(false);
  });

  it('never equate ids of different kinds that read alike', () => {
    const workspaceId: Comparable = WorkspaceId.of('a');
    const teamId: Comparable = TeamId.of('a');

    expect(workspaceId.equals(UserId.of('a'))).toBe(false);
    expect(teamId.equals(UserId.of('a'))).toBe(false);
  });

  it('reject an empty identifier', () => {
    expect(() => UserId.of('  ')).toThrow(InvalidIdentifierError);
    expect(() => TeamId.of('')).toThrow(InvalidIdentifierError);
  });

  it('render as their bare value', () => {
    expect(String(WorkspaceId.of('ws_1'))).toBe('ws_1');
  });
});
