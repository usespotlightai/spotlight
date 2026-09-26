import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenTrustDefined } from '@identity/domain/events/workspace-token-trust-defined.event';
import { WorkspaceTokenTrustRedefined } from '@identity/domain/events/workspace-token-trust-redefined.event';
import { WorkspaceTokenTrustWithdrawn } from '@identity/domain/events/workspace-token-trust-withdrawn.event';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustKeyFixedError } from '@identity/domain/exceptions/token-trust-key-fixed.error';
import { TokenTrustMovedOnError } from '@identity/domain/exceptions/token-trust-moved-on.error';
import { WorkloadNotAdmittedError } from '@identity/domain/exceptions/workload-not-admitted.error';
import type { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import type { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export interface TokenTrustTerms {
  readonly key: TokenTrustKey;
  readonly workload: WorkloadRule;
  readonly scopes: TokenScopes;
  readonly lifetime: TokenLifetime;
}

interface Kept extends TokenTrustTerms {
  readonly id: WorkspaceTokenTrustId;
  readonly workspaceId: WorkspaceId;
  readonly definedBy: UserId;
  readonly version: number;
}

interface State extends Kept {
  readonly withdrawn: boolean;
}

export class WorkspaceTokenTrust extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static define(
    input: TokenTrustTerms & {
      id: WorkspaceTokenTrustId;
      workspaceId: WorkspaceId;
      definedBy: UserId;
      grantor: TokenScopes | null;
      by: Attribution;
    },
  ): WorkspaceTokenTrust {
    if (input.grantor && !input.grantor.covers(input.scopes)) {
      throw new TokenTrustBeyondGrantorError(input.key.value);
    }

    const defined = new WorkspaceTokenTrust({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      workload: input.workload,
      scopes: input.scopes,
      lifetime: input.lifetime,
      definedBy: input.definedBy,
      version: 0,
      withdrawn: false,
    });

    defined.record(
      new WorkspaceTokenTrustDefined(
        defined.id,
        defined.workspaceId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
  }

  static rehydrate(input: Kept): WorkspaceTokenTrust {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'workspace token trust',
        `has an impossible version (${input.version})`,
      );
    }

    return new WorkspaceTokenTrust({ ...input, withdrawn: false });
  }

  expecting(version: number): void {
    if (version !== this.version) {
      throw new TokenTrustMovedOnError(this.id.value);
    }
  }

  redefinedAs(
    terms: TokenTrustTerms,
    grantor: TokenScopes | null,
    by: Attribution,
  ): WorkspaceTokenTrust {
    this.guardStanding();

    if (
      grantor &&
      !(grantor.covers(this.scopes) && grantor.covers(terms.scopes))
    ) {
      throw new TokenTrustBeyondGrantorError(this.key.value);
    }

    if (!terms.key.equals(this.key)) {
      throw new TokenTrustKeyFixedError(
        this.key.value,
        `keeps its key for its whole life, since it is the trust's address; replace it to key a trust ${terms.key.value}`,
      );
    }

    if (this.hasTerms(terms)) {
      return this;
    }

    const redefined = this.with({
      workload: terms.workload,
      scopes: terms.scopes,
      lifetime: terms.lifetime,
    });

    redefined.record(
      new WorkspaceTokenTrustRedefined(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  withdrawn(by: Attribution): WorkspaceTokenTrust {
    this.guardStanding();

    const withdrawn = this.with({ withdrawn: true });

    withdrawn.record(
      new WorkspaceTokenTrustWithdrawn(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return withdrawn;
  }

  admits(workload: WorkloadClaims): boolean {
    return !this.isWithdrawn && this.workload.admits(workload);
  }

  mintFor(
    workload: WorkloadClaims,
    minted: {
      id: WorkspaceTokenId;
      hash: TokenHash;
      now: Date;
      client: Client;
    },
  ): WorkspaceToken {
    if (!this.admits(workload)) {
      throw new WorkloadNotAdmittedError(this.key.value);
    }

    return WorkspaceToken.minted({
      id: minted.id,
      workspaceId: this.workspaceId,
      name: TokenName.of(this.key.value),
      scopes: this.scopes,
      expiresAt: this.lifetime.endingFrom(minted.now),
      hash: minted.hash,
      issuedBy: this.definedBy,
      mintedThrough: this.id,
      mintedUnder: this.version,
      subject: workload.subject,
      now: minted.now,
      client: minted.client,
    });
  }

  stillGrants(token: WorkspaceToken): boolean {
    return (
      !this.isWithdrawn &&
      token.mintedThrough?.equals(this.id) === true &&
      token.mintedUnder === this.version
    );
  }

  get id(): WorkspaceTokenTrustId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get key(): TokenTrustKey {
    return this.state.key;
  }

  get workload(): WorkloadRule {
    return this.state.workload;
  }

  get scopes(): TokenScopes {
    return this.state.scopes;
  }

  get lifetime(): TokenLifetime {
    return this.state.lifetime;
  }

  get definedBy(): UserId {
    return this.state.definedBy;
  }

  get version(): number {
    return this.state.version;
  }

  get isWithdrawn(): boolean {
    return this.state.withdrawn;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-token-trust' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private hasTerms(terms: TokenTrustTerms): boolean {
    return (
      terms.workload.equals(this.workload) &&
      terms.scopes.equals(this.scopes) &&
      terms.lifetime.equals(this.lifetime)
    );
  }

  private guardStanding(): void {
    if (this.isWithdrawn) {
      throw new InconsistentStateError(
        'workspace token trust',
        'was changed after it was withdrawn',
      );
    }
  }

  private with(change: Partial<State>): WorkspaceTokenTrust {
    const next = new WorkspaceTokenTrust({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }
}
