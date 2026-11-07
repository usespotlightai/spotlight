import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface IssuedApiGrant {
  readonly issuedBy: UserId;
  readonly scopes: readonly string[];
  readonly expiresAt: Date;
}

export interface RunApiGrantParts {
  readonly actingFor: string;
  readonly scopes: readonly string[];
  readonly lifetimeMs: number;
}

export class RunApiGrant {
  private constructor(
    readonly actingFor: UserId,
    readonly scopes: readonly string[],
    readonly lifetimeMs: number,
  ) {}

  static of(parts: RunApiGrantParts): RunApiGrant {
    if (parts.scopes.length === 0) {
      throw new InvalidRunOrderError('must grant the API at least one scope');
    }

    if (!Number.isInteger(parts.lifetimeMs) || parts.lifetimeMs <= 0) {
      throw new InvalidRunOrderError('must grant the API for a while');
    }

    return new RunApiGrant(
      UserId.of(parts.actingFor),
      [...parts.scopes],
      parts.lifetimeMs,
    );
  }

  issuedAt(now: Date): IssuedApiGrant {
    return {
      issuedBy: this.actingFor,
      scopes: [...this.scopes],
      expiresAt: new Date(now.getTime() + this.lifetimeMs),
    };
  }

  get parts(): RunApiGrantParts {
    return {
      actingFor: this.actingFor.value,
      scopes: [...this.scopes],
      lifetimeMs: this.lifetimeMs,
    };
  }
}
