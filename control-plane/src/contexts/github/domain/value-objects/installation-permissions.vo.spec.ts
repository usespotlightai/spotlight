import { InstallationPermissions } from '@github/domain/value-objects/installation-permissions.vo';
import { describe, expect, it } from 'vitest';

describe('InstallationPermissions', () => {
  it('changes workflows only with workflows: write', () => {
    expect(
      InstallationPermissions.of({ workflows: 'write' }).changesWorkflows(),
    ).toBe(true);
    expect(
      InstallationPermissions.of({ contents: 'write' }).changesWorkflows(),
    ).toBe(false);
  });

  it('sets repository variables only with Variables: read and write', () => {
    expect(
      InstallationPermissions.of({
        actions_variables: 'write',
      }).setsVariables(),
    ).toBe(true);
    expect(
      InstallationPermissions.of({ actions_variables: 'read' }).setsVariables(),
    ).toBe(false);
    expect(InstallationPermissions.of({}).setsVariables()).toBe(false);
  });

  it('ignores what is not a level', () => {
    expect(
      InstallationPermissions.of({ workflows: true }).changesWorkflows(),
    ).toBe(false);
  });

  it('equals the same grants, whatever their order', () => {
    expect(
      InstallationPermissions.of({
        contents: 'write',
        workflows: 'write',
      }).equals(
        InstallationPermissions.of({ workflows: 'write', contents: 'write' }),
      ),
    ).toBe(true);
    expect(
      InstallationPermissions.of({ contents: 'write' }).equals(
        InstallationPermissions.of({ contents: 'write', workflows: 'write' }),
      ),
    ).toBe(false);
  });

  it('reads an installation as GitHub answers it', () => {
    const answered = InstallationPermissions.of({
      actions: 'read',
      actions_variables: 'write',
      administration: 'write',
      checks: 'read',
      contents: 'write',
      issues: 'write',
      metadata: 'read',
      members: 'read',
      pull_requests: 'write',
      workflows: 'write',
    });

    expect(answered.changesWorkflows()).toBe(true);
    expect(answered.setsVariables()).toBe(true);
  });

  it('grants beyond another only in what Spotlight relies on', () => {
    const code = InstallationPermissions.of({ contents: 'write' });

    expect(
      InstallationPermissions.of({
        contents: 'write',
        workflows: 'write',
      }).grantsBeyond(code),
    ).toBe(true);
    expect(
      InstallationPermissions.of({
        contents: 'write',
        actions_variables: 'write',
      }).grantsBeyond(code),
    ).toBe(true);
    expect(
      InstallationPermissions.of({
        contents: 'write',
        issues: 'write',
      }).grantsBeyond(InstallationPermissions.of({})),
    ).toBe(false);
    expect(code.grantsBeyond(code)).toBe(false);
  });
});
