import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRedescribed } from '@identity/domain/events/workspace-token-redescribed.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import type { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export interface TokenTerms {
  readonly name: TokenName;
  readonly description: TokenDescription;
  readonly scopes: TokenScopes;
  readonly expiresAt: Date | null;
}

interface Kept extends TokenTerms {
  readonly id: WorkspaceTokenId;
  readonly workspaceId: WorkspaceId;
  readonly hash: TokenHash;
  readonly issuedBy: UserId;
  readonly issuedAt: Date;
  readonly version: number;
}

interface State extends Kept {
  readonly revoked: boolean;
}

const FIXED =
  'is fixed for the life of the token; replace the token to change it';

const sameInstant = (a: Date | null, b: Date | null): boolean =>
  a?.getTime() === b?.getTime();

export class WorkspaceToken extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static issue(
    input: Omit<Kept, 'version' | 'issuedAt'> & { now: Date; by: Attribution },
  ): WorkspaceToken {
    if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
      throw new InvalidWorkspaceTokenError(
        'expiresAt',
        'is a moment still to come, since a token that has expired admits nobody',
      );
    }

    const issued = new WorkspaceToken({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      hash: input.hash,
      issuedBy: input.issuedBy,
      issuedAt: input.now,
      version: 0,
      revoked: false,
    });

    issued.record(
      new WorkspaceTokenIssued(
        issued.id,
        issued.workspaceId,
        issued.name,
        ConfigurationChange.created(issued.whatChanged, input.by),
      ),
    );

    return issued;
  }

  static rehydrate(input: Kept): WorkspaceToken {
    return new WorkspaceToken({ ...input, revoked: false });
  }

  expecting(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceTokenMovedOnError(this.id.value);
    }
  }

  redescribed(terms: TokenTerms, by: Attribution): WorkspaceToken {
    this.guardStanding();

    if (!terms.name.equals(this.name)) {
      throw new WorkspaceTokenTermsFixedError('name', FIXED);
    }

    if (!terms.scopes.equals(this.scopes)) {
      throw new WorkspaceTokenTermsFixedError('scopes', FIXED);
    }

    if (!sameInstant(terms.expiresAt, this.expiresAt)) {
      throw new WorkspaceTokenTermsFixedError('expiresAt', FIXED);
    }

    const redescribed = this.with({ description: terms.description });

    redescribed.record(
      new WorkspaceTokenRedescribed(
        this.id,
        this.workspaceId,
        this.name,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redescribed;
  }

  revoked(by: Attribution): WorkspaceToken {
    this.guardStanding();

    const revoked = this.with({ revoked: true });

    revoked.record(
      new WorkspaceTokenRevoked(
        this.id,
        this.workspaceId,
        this.name,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return revoked;
  }

  admitsAt(now: Date): boolean {
    return (
      !this.isRevoked &&
      (this.expiresAt === null || this.expiresAt.getTime() > now.getTime())
    );
  }

  get principal(): TokenPrincipal {
    return TokenPrincipal.of({
      tokenId: this.id,
      workspaceId: this.workspaceId,
      scopes: this.scopes,
      issuedBy: this.issuedBy,
    });
  }

  get id(): WorkspaceTokenId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get name(): TokenName {
    return this.state.name;
  }

  get description(): TokenDescription {
    return this.state.description;
  }

  get scopes(): TokenScopes {
    return this.state.scopes;
  }

  get expiresAt(): Date | null {
    return this.state.expiresAt;
  }

  get hash(): TokenHash {
    return this.state.hash;
  }

  get issuedBy(): UserId {
    return this.state.issuedBy;
  }

  get issuedAt(): Date {
    return this.state.issuedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isRevoked(): boolean {
    return this.state.revoked;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-token' as const,
      id: this.id.value,
      key: this.name.value,
    };
  }

  private with(change: Partial<State>): WorkspaceToken {
    const next = new WorkspaceToken({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardStanding(): void {
    if (this.isRevoked) {
      throw new InconsistentStateError(
        'workspace token',
        'was changed after it was revoked',
      );
    }
  }
}
