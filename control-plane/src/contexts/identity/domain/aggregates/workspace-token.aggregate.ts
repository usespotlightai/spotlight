import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenLapsed } from '@identity/domain/events/workspace-token-lapsed.event';
import { WorkspaceTokenRedescribed } from '@identity/domain/events/workspace-token-redescribed.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { MintedTokenFixedError } from '@identity/domain/exceptions/minted-token-fixed.error';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import { MintedTokenDetail } from '@identity/domain/value-objects/minted-token-detail.vo';
import { RunTokenDetail } from '@identity/domain/value-objects/run-token-detail.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

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
  readonly mintedThrough: WorkspaceTokenTrustId | null;
  readonly mintedUnder: number | null;
  readonly mintedForRun: RunId | null;
  readonly mintedForAttempt: number | null;
  readonly version: number;
}

interface State extends Kept {
  readonly revoked: boolean;
}

const RUN_TOKEN_LONGEST_MS = 60 * 60 * 1_000;

const FIXED = 'cannot change after the token is issued';

const sameInstant = (a: Date | null, b: Date | null): boolean =>
  a?.getTime() === b?.getTime();

export class WorkspaceToken extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static issue(
    input: Omit<
      Kept,
      | 'version'
      | 'issuedAt'
      | 'mintedThrough'
      | 'mintedUnder'
      | 'mintedForRun'
      | 'mintedForAttempt'
    > & {
      now: Date;
      by: Attribution;
    },
  ): WorkspaceToken {
    if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
      throw new InvalidWorkspaceTokenError(
        'expiresAt',
        'must be in the future',
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
      mintedThrough: null,
      mintedUnder: null,
      mintedForRun: null,
      mintedForAttempt: null,
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

  static minted(
    input: Omit<
      Kept,
      | 'version'
      | 'issuedAt'
      | 'description'
      | 'expiresAt'
      | 'mintedForRun'
      | 'mintedForAttempt'
    > & {
      mintedThrough: WorkspaceTokenTrustId;
      mintedUnder: number;
      expiresAt: Date;
      subject: string;
      now: Date;
      client: Client;
    },
  ): WorkspaceToken {
    const minted = new WorkspaceToken({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: TokenDescription.of(''),
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      hash: input.hash,
      issuedBy: input.issuedBy,
      issuedAt: input.now,
      mintedThrough: input.mintedThrough,
      mintedUnder: input.mintedUnder,
      mintedForRun: null,
      mintedForAttempt: null,
      version: 0,
      revoked: false,
    });

    minted.record(
      new WorkspaceTokenIssued(
        minted.id,
        minted.workspaceId,
        minted.name,
        ConfigurationChange.created(
          minted.whatChanged,
          Attribution.of(
            Actor.of(minted.principal, input.client),
            minted.workspaceId,
          ),
          MintedTokenDetail.of({
            mintedThrough: input.mintedThrough,
            subject: input.subject,
            scopes: input.scopes.all.map((each) => each.value),
            expiresAt: input.expiresAt,
          }),
        ),
      ),
    );

    return minted;
  }

  static forRun(input: {
    id: WorkspaceTokenId;
    workspaceId: WorkspaceId;
    name: TokenName;
    scopes: TokenScopes;
    hash: TokenHash;
    issuedBy: UserId;
    runId: RunId;
    attempt: number;
    expiresAt: Date;
    now: Date;
  }): WorkspaceToken {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InvalidWorkspaceTokenError(
        'attempt',
        'must be a run attempt, counted from 1',
      );
    }

    if (input.expiresAt.getTime() <= input.now.getTime()) {
      throw new InvalidWorkspaceTokenError(
        'expiresAt',
        'must be in the future',
      );
    }

    if (
      input.expiresAt.getTime() - input.now.getTime() >
      RUN_TOKEN_LONGEST_MS
    ) {
      throw new InvalidWorkspaceTokenError(
        'expiresAt',
        'must be at most an hour after it is minted',
      );
    }

    if (input.scopes.all.some((each) => !TokenScope.plan.grants(each))) {
      throw new InvalidWorkspaceTokenError('scopes', 'must be plan or read');
    }

    const minted = new WorkspaceToken({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: TokenDescription.of(''),
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      hash: input.hash,
      issuedBy: input.issuedBy,
      issuedAt: input.now,
      mintedThrough: null,
      mintedUnder: null,
      mintedForRun: input.runId,
      mintedForAttempt: input.attempt,
      version: 0,
      revoked: false,
    });

    minted.record(
      new WorkspaceTokenIssued(
        minted.id,
        minted.workspaceId,
        minted.name,
        ConfigurationChange.created(
          minted.whatChanged,
          Attribution.spotlight(minted.workspaceId),
          RunTokenDetail.of({
            runId: input.runId,
            attempt: input.attempt,
            scopes: input.scopes.all.map((each) => each.value),
            expiresAt: input.expiresAt,
          }),
        ),
      ),
    );

    return minted;
  }

  static rehydrate(input: Kept): WorkspaceToken {
    if ((input.mintedForRun === null) !== (input.mintedForAttempt === null)) {
      throw new InconsistentStateError(
        'workspace token',
        'names the attempt it was minted for when, and only when, it was minted for a run',
      );
    }

    return new WorkspaceToken({ ...input, revoked: false });
  }

  expecting(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceTokenMovedOnError(this.id.value);
    }
  }

  redescribed(terms: TokenTerms, by: Attribution): WorkspaceToken {
    this.guardStanding();

    if (this.isMinted) {
      throw new MintedTokenFixedError(this.name.value);
    }

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

  lapsed(now: Date): WorkspaceToken {
    this.guardStanding();

    if (this.admitsAt(now)) {
      throw new InconsistentStateError(
        'workspace token',
        'was let lapse before it expired',
      );
    }

    const lapsed = this.with({ revoked: true });

    lapsed.record(
      new WorkspaceTokenLapsed(this.id, this.workspaceId, this.name),
    );

    return lapsed;
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
      mintedThrough: this.mintedThrough,
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

  expiry(): Date {
    if (!this.state.expiresAt) {
      throw new InconsistentStateError(
        'workspace token',
        'was asked when it expires, but it never does',
      );
    }

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

  get mintedThrough(): WorkspaceTokenTrustId | null {
    return this.state.mintedThrough;
  }

  get mintedUnder(): number | null {
    return this.state.mintedUnder;
  }

  get mintedForRun(): RunId | null {
    return this.state.mintedForRun;
  }

  get mintedForAttempt(): number | null {
    return this.state.mintedForAttempt;
  }

  standsUnder(trust: WorkspaceTokenTrust | null): boolean {
    return this.mintedThrough === null || trust?.stillGrants(this) === true;
  }

  get isMinted(): boolean {
    return (
      this.state.mintedThrough !== null || this.state.mintedForRun !== null
    );
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
