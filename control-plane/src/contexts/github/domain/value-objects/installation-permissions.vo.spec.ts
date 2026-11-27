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
});
