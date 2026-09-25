import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { Permission } from '@shared-kernel/domain/value-objects/permission';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';

const SCOPED: readonly (readonly [TokenScope, Permission])[] = [
  [TokenScope.read, 'read'],
  [TokenScope.plan, 'plan'],
  [TokenScope.configure, 'configure'],
  [TokenScope.secrets, 'manage-secrets'],
  [TokenScope.runners, 'manage-runners'],
  [TokenScope.trusts, 'manage-token-trusts'],
];

const MEMBER: readonly Permission[] = ['read', 'plan'];

const ADMIN: readonly Permission[] = [
  'read',
  'plan',
  'configure',
  'manage-secrets',
  'manage-runners',
  'manage-token-trusts',
  'administer',
];

const grantedBy = (scopes: TokenScopes): readonly Permission[] =>
  SCOPED.filter(([scope]) => scopes.allow(scope)).map(
    ([, permission]) => permission,
  );

export class Clearance {
  static readonly none = new Clearance([]);

  private readonly granted: ReadonlySet<Permission>;

  private constructor(granted: readonly Permission[]) {
    this.granted = new Set(granted);
  }

  static ofRole(role: WorkspaceRole): Clearance {
    return new Clearance(
      role.rankedAtLeast(WorkspaceRole.admin) ? ADMIN : MEMBER,
    );
  }

  static ofScopes(scopes: TokenScopes): Clearance {
    return new Clearance(grantedBy(scopes));
  }

  static beyondWorkspaces(principal: Principal): Clearance {
    return principal.kind === 'person'
      ? new Clearance(['plan', 'open-workspaces'])
      : new Clearance(principal.scopes.allow(TokenScope.plan) ? ['plan'] : []);
  }

  get reads(): boolean {
    return this.granted.has('read');
  }

  get plans(): boolean {
    return this.granted.has('plan');
  }

  get configures(): boolean {
    return this.granted.has('configure');
  }

  get managesSecrets(): boolean {
    return this.granted.has('manage-secrets');
  }

  get managesRunners(): boolean {
    return this.granted.has('manage-runners');
  }

  get managesTokenTrusts(): boolean {
    return this.granted.has('manage-token-trusts');
  }

  get administers(): boolean {
    return this.granted.has('administer');
  }

  get opensWorkspaces(): boolean {
    return this.granted.has('open-workspaces');
  }
}
