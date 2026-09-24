import { InvalidTokenScopeError } from '@shared-kernel/domain/exceptions/invalid-token-scope.error';

export const TOKEN_SCOPES = ['read', 'plan', 'configure', 'secrets'] as const;

export type TokenScopeName = (typeof TOKEN_SCOPES)[number];

const GRANTS: Readonly<Record<TokenScopeName, readonly TokenScopeName[]>> = {
  read: ['read'],
  plan: ['plan', 'read'],
  configure: ['configure', 'plan', 'read'],
  secrets: ['secrets', 'read'],
};

export class TokenScope {
  static readonly read = new TokenScope('read');
  static readonly plan = new TokenScope('plan');
  static readonly configure = new TokenScope('configure');
  static readonly secrets = new TokenScope('secrets');

  private constructor(readonly value: TokenScopeName) {}

  static of(raw: string): TokenScope {
    const named = raw.trim();
    const known = TokenScope.all.find((each) => each.value === named);

    if (!known) {
      throw new InvalidTokenScopeError(
        `are each one of ${TOKEN_SCOPES.join(', ')}, not ${named || 'nothing'}`,
      );
    }

    return known;
  }

  static get all(): readonly TokenScope[] {
    return [
      TokenScope.read,
      TokenScope.plan,
      TokenScope.configure,
      TokenScope.secrets,
    ];
  }

  get isLadder(): boolean {
    return this.value !== 'secrets';
  }

  grants(scope: TokenScope): boolean {
    return GRANTS[this.value].includes(scope.value);
  }

  equals(other: TokenScope): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
