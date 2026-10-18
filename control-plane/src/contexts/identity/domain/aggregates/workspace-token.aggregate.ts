import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { WorkspaceTokenExpired } from '@identity/domain/events/workspace-token-expired.event';
import { WorkspaceTokenIssued } from '@identity/domain/events/workspace-token-issued.event';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { WorkspaceTokenUpdated } from '@identity/domain/events/workspace-token-updated.event';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import { IssuedTokenDetail } from '@identity/domain/value-objects/issued-token-detail.vo';
import { RunTokenDetail } from '@identity/domain/value-objects/run-token-detail.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
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

export interface TokenSpec {
  readonly name: TokenName;
  readonly description: TokenDescription;
  readonly scopes: TokenScopes;
  readonly expiresAt: Date | null;
}

interface Props extends TokenSpec {
  readonly id: WorkspaceTokenId;
  readonly workspaceId: WorkspaceId;
  readonly hash: TokenHash;
  readonly issuedBy: UserId;
  readonly issuedAt: Date;
  readonly issuedByTrustId: WorkspaceTokenTrustId | null;
  readonly trustVersion: number | null;
  readonly runId: RunId | null;
  readonly runAttempt: number | null;
  readonly version: number;
}

interface State extends Props {
  readonly revoked: boolean;
}

const RUN_TOKEN_LONGEST_MS = 60 * 60 * 1_000;

const IMMUTABLE = 'cannot change after the token is issued';

const sameInstant = (a: Date | null, b: Date | null): boolean =>
  a?.getTime() === b?.getTime();

export class WorkspaceToken extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static issue(
    input: Omit<
      Props,
      | 'version'
      | 'issuedAt'
      | 'issuedByTrustId'
      | 'trustVersion'
      | 'runId'
      | 'runAttempt'
    > & {
      now: Date;
      by: ChangeActor;
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
      issuedByTrustId: null,
      trustVersion: null,
      runId: null,
      runAttempt: null,
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

  static issueByTrust(
    input: Omit<
      Props,
      | 'version'
      | 'issuedAt'
      | 'description'
      | 'expiresAt'
      | 'runId'
      | 'runAttempt'
    > & {
      issuedByTrustId: WorkspaceTokenTrustId;
      trustVersion: number;
      expiresAt: Date;
      subject: string;
      now: Date;
      client: Client;
    },
  ): WorkspaceToken {
    const issued = new WorkspaceToken({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: TokenDescription.of(''),
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      hash: input.hash,
      issuedBy: input.issuedBy,
      issuedAt: input.now,
      issuedByTrustId: input.issuedByTrustId,
      trustVersion: input.trustVersion,
      runId: null,
      runAttempt: null,
      version: 0,
      revoked: false,
    });

    issued.record(
      new WorkspaceTokenIssued(
        issued.id,
        issued.workspaceId,
        issued.name,
        ConfigurationChange.created(
          issued.whatChanged,
          ChangeActor.of(
            Actor.of(issued.principal, input.client),
            issued.workspaceId,
          ),
          IssuedTokenDetail.of({
            issuedByTrustId: input.issuedByTrustId,
            subject: input.subject,
            scopes: input.scopes.all.map((each) => each.value),
            expiresAt: input.expiresAt,
          }),
        ),
      ),
    );

    return issued;
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
        'must be at most an hour after it is issued',
      );
    }

    if (input.scopes.all.some((each) => !TokenScope.plan.grants(each))) {
      throw new InvalidWorkspaceTokenError('scopes', 'must be plan or read');
    }

    const issued = new WorkspaceToken({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: TokenDescription.of(''),
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      hash: input.hash,
      issuedBy: input.issuedBy,
      issuedAt: input.now,
      issuedByTrustId: null,
      trustVersion: null,
      runId: input.runId,
      runAttempt: input.attempt,
      version: 0,
      revoked: false,
    });

    issued.record(
      new WorkspaceTokenIssued(
        issued.id,
        issued.workspaceId,
        issued.name,
        ConfigurationChange.created(
          issued.whatChanged,
          ChangeActor.spotlight(issued.workspaceId),
          RunTokenDetail.of({
            runId: input.runId,
            attempt: input.attempt,
            scopes: input.scopes.all.map((each) => each.value),
            expiresAt: input.expiresAt,
          }),
        ),
      ),
    );

    return issued;
  }

  static rehydrate(input: Props): WorkspaceToken {
    if ((input.runId === null) !== (input.runAttempt === null)) {
      throw new InconsistentStateError(
        'workspace token',
        'names the attempt it was issued for when, and only when, it was issued for a run',
      );
    }

    return new WorkspaceToken({ ...input, revoked: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceTokenVersionConflictError(this.id.value);
    }
  }

  update(spec: TokenSpec, by: ChangeActor): WorkspaceToken {
    this.assertNotDeleted();

    if (this.isIssuedBySpotlight) {
      throw new ImmutableFieldError(
        'description',
        'cannot change on a token Spotlight issued',
        `Token ${this.name.value} was issued by Spotlight. Its description cannot change.`,
      );
    }

    if (!spec.name.equals(this.name)) {
      throw new ImmutableFieldError(
        'name',
        IMMUTABLE,
        `Workspace token name ${IMMUTABLE}.`,
      );
    }

    if (!spec.scopes.equals(this.scopes)) {
      throw new ImmutableFieldError(
        'scopes',
        IMMUTABLE,
        `Workspace token scopes ${IMMUTABLE}.`,
      );
    }

    if (!sameInstant(spec.expiresAt, this.expiresAt)) {
      throw new ImmutableFieldError(
        'expiresAt',
        IMMUTABLE,
        `Workspace token expiresAt ${IMMUTABLE}.`,
      );
    }

    const updated = this.with({ description: spec.description });

    updated.record(
      new WorkspaceTokenUpdated(
        this.id,
        this.workspaceId,
        this.name,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  revoke(by: ChangeActor): WorkspaceToken {
    this.assertNotDeleted();

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

  expire(now: Date): WorkspaceToken {
    this.assertNotDeleted();

    if (this.isActiveAt(now)) {
      throw new InconsistentStateError(
        'workspace token',
        'was marked expired before its expiry time',
      );
    }

    const expired = this.with({ revoked: true });

    expired.record(
      new WorkspaceTokenExpired(this.id, this.workspaceId, this.name),
    );

    return expired;
  }

  isActiveAt(now: Date): boolean {
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
      issuedByTrustId: this.issuedByTrustId,
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
        'was queried for its expiry, but it never expires',
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

  get issuedByTrustId(): WorkspaceTokenTrustId | null {
    return this.state.issuedByTrustId;
  }

  get trustVersion(): number | null {
    return this.state.trustVersion;
  }

  get runId(): RunId | null {
    return this.state.runId;
  }

  get runAttempt(): number | null {
    return this.state.runAttempt;
  }

  isStillValidFor(trust: WorkspaceTokenTrust | null): boolean {
    return this.issuedByTrustId === null || trust?.stillGrants(this) === true;
  }

  get isIssuedBySpotlight(): boolean {
    return this.state.issuedByTrustId !== null || this.state.runId !== null;
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

  private assertNotDeleted(): void {
    if (this.isRevoked) {
      throw new InconsistentStateError(
        'workspace token',
        'was changed after it was revoked',
      );
    }
  }
}
