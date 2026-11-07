import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';

export const TOKEN_HOLDER_KINDS = ['pool', 'egress'] as const;

export type TokenHolderKind = (typeof TOKEN_HOLDER_KINDS)[number];

export class TokenHolder {
  private constructor(
    readonly kind: TokenHolderKind,
    readonly id: string,
  ) {}

  static pool(id: RunnerPoolId): TokenHolder {
    return new TokenHolder('pool', id.value);
  }

  static egress(id: EgressId): TokenHolder {
    return new TokenHolder('egress', id.value);
  }

  equals(other: TokenHolder): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
