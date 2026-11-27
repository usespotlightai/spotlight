import { CallSecretsExpiredError } from '@runs/domain/exceptions/call-secrets-expired.error';
import { CallSecretsRedeemedError } from '@runs/domain/exceptions/call-secrets-redeemed.error';
import { InvalidNetworkCallTransitionError } from '@runs/domain/exceptions/invalid-network-call-transition.error';
import { InvalidNetworkCallError } from '@runs/domain/exceptions/invalid-network-call.error';
import { NotThisHostsCallError } from '@runs/domain/exceptions/not-this-hosts-call.error';
import { WrongCallSecretsTokenError } from '@runs/domain/exceptions/wrong-call-secrets-token.error';
import { CallSecretsClaim } from '@runs/domain/value-objects/call-secrets-claim.vo';
import type { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import type { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import type { NetworkRequest } from '@runs/domain/value-objects/network-request.vo';
import type { NetworkResponse } from '@runs/domain/value-objects/network-response.vo';
import { distinct } from '@shared-kernel/domain/distinct';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type NetworkCallProgress =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'claimed'; readonly by: CallingHost; readonly at: Date }
  | {
      readonly kind: 'answered';
      readonly by: CallingHost;
      readonly claimedAt: Date;
      readonly at: Date;
      readonly response: NetworkResponse;
    }
  | { readonly kind: 'expired'; readonly at: Date; readonly claimed: boolean }
  | {
      readonly kind: 'cancelled';
      readonly at: Date;
      readonly claimed: boolean;
    };

export type NetworkCallState = NetworkCallProgress['kind'];

export const NETWORK_CALL_STATES = [
  'waiting',
  'claimed',
  'answered',
  'expired',
  'cancelled',
] as const satisfies readonly NetworkCallState[];

interface State {
  readonly id: NetworkCallId;
  readonly workspaceId: WorkspaceId;
  readonly request: NetworkRequest;
  readonly secrets: readonly SecretName[];
  readonly secretsClaim: CallSecretsClaim | null;
  readonly queuedAt: Date;
  readonly expiresAt: Date;
  readonly progress: NetworkCallProgress;
  readonly version: number;
}

const RETENTION_MS = 7 * 24 * 60 * 60_000;

const LEAST_TIMEOUT_MS = 1_000;

const cancelledMessage = (id: string): string =>
  `Network call ${id} was cancelled. Its caller stopped waiting for it.`;

export type NetworkCallView =
  | { readonly kind: 'answered'; readonly response: NetworkResponse }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'expired'; readonly claimed: boolean };

export class NetworkCall extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDiscarded = false,
  ) {
    super();
  }

  static queue(input: {
    id: NetworkCallId;
    workspaceId: WorkspaceId;
    request: NetworkRequest;
    secrets?: readonly SecretName[];
    expiresAt: Date;
    now: Date;
  }): NetworkCall {
    if (input.expiresAt.getTime() <= input.now.getTime()) {
      throw new InvalidNetworkCallError(
        'must give a host time to send it before it expires',
      );
    }

    return new NetworkCall({
      id: input.id,
      workspaceId: input.workspaceId,
      request: input.request,
      secrets: distinct(input.secrets ?? []),
      secretsClaim: null,
      queuedAt: input.now,
      expiresAt: input.expiresAt,
      progress: { kind: 'waiting' },
      version: 0,
    });
  }

  static rehydrate(state: State): NetworkCall {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'network call',
        `has an impossible version (${state.version})`,
      );
    }

    if (
      state.progress.kind !== 'waiting' &&
      state.progress.kind !== 'claimed' &&
      !state.request.isSpent
    ) {
      throw new InconsistentStateError(
        'network call',
        'still has what it sent after it completed',
      );
    }

    if (
      state.secretsClaim &&
      (state.progress.kind === 'waiting' || state.secrets.length === 0)
    ) {
      throw new InconsistentStateError(
        'network call',
        'has a token to redeem secrets that no host claimed',
      );
    }

    if (state.expiresAt < state.queuedAt) {
      throw new InconsistentStateError(
        'network call',
        'expires before it was queued',
      );
    }

    return new NetworkCall(state);
  }

  get id(): NetworkCallId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get request(): NetworkRequest {
    return this.state.request;
  }

  get secrets(): readonly SecretName[] {
    return this.state.secrets;
  }

  get secretsClaim(): CallSecretsClaim | null {
    return this.state.secretsClaim;
  }

  get namesSecrets(): boolean {
    return this.state.secrets.length > 0;
  }

  get queuedAt(): Date {
    return this.state.queuedAt;
  }

  get expiresAt(): Date {
    return this.state.expiresAt;
  }

  get progress(): NetworkCallProgress {
    return this.state.progress;
  }

  get version(): number {
    return this.state.version;
  }

  get response(): NetworkResponse | null {
    return this.state.progress.kind === 'answered'
      ? this.state.progress.response
      : null;
  }

  timeoutAt(now: Date): number {
    return Math.max(
      LEAST_TIMEOUT_MS,
      Math.min(
        this.state.request.timeoutMs,
        this.state.expiresAt.getTime() - now.getTime(),
      ),
    );
  }

  viewAt(now: Date): NetworkCallView {
    const { progress } = this.state;

    if (progress.kind === 'answered') {
      return { kind: 'answered', response: progress.response };
    }

    const state = this.stateAt(now);

    if (state === 'waiting' || state === 'claimed') {
      return { kind: 'waiting' };
    }

    return {
      kind: 'expired',
      claimed:
        progress.kind === 'claimed' ||
        ((progress.kind === 'expired' || progress.kind === 'cancelled') &&
          progress.claimed),
    };
  }

  stateAt(now: Date): NetworkCallState {
    const { kind } = this.state.progress;

    return (kind === 'waiting' || kind === 'claimed') && this.isExpiredAt(now)
      ? 'expired'
      : kind;
  }

  get isCompleted(): boolean {
    return this.completedAt !== null;
  }

  get completedAt(): Date | null {
    const { progress } = this.state;

    return progress.kind === 'waiting' || progress.kind === 'claimed'
      ? null
      : progress.at;
  }

  static retentionCutoff(now: Date): Date {
    return new Date(now.getTime() - RETENTION_MS);
  }

  isPastRetention(now: Date): boolean {
    const completedAt = this.completedAt;

    return (
      completedAt !== null &&
      now.getTime() >= completedAt.getTime() + RETENTION_MS
    );
  }

  purge(now: Date): NetworkCall {
    if (!this.isPastRetention(now)) {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is stored for a week after it completes.`,
      );
    }

    const purged = new NetworkCall(this.state, true);
    purged.inheritEvents(this);

    return purged;
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.state.workspaceId.equals(workspaceId);
  }

  claimedBy(
    host: CallingHost,
    now: Date,
    secretsToken: TokenHash | null = null,
  ): NetworkCall {
    const phase = this.stateAt(now);

    if (phase === 'cancelled') {
      throw new InvalidNetworkCallTransitionError(
        cancelledMessage(this.state.id.value),
      );
    }

    if (phase !== 'waiting') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is ${phase}. It cannot be claimed.`,
      );
    }

    if (this.namesSecrets && !secretsToken) {
      throw new InvalidNetworkCallError(
        'that names secrets must be claimed with a token to redeem them',
      );
    }

    return this.with({
      progress: { kind: 'claimed', by: host, at: now },
      secretsClaim:
        this.namesSecrets && secretsToken
          ? CallSecretsClaim.issued(secretsToken)
          : null,
    });
  }

  redeemSecrets(
    host: CallingHost,
    tokenHash: TokenHash,
    now: Date,
  ): NetworkCall {
    const { progress, secretsClaim } = this.state;
    const id = this.state.id.value;

    if (!secretsClaim?.isRedeemedBy(tokenHash)) {
      throw new WrongCallSecretsTokenError(id);
    }

    const phase = this.stateAt(now);

    if (phase === 'expired' || phase === 'cancelled') {
      throw new CallSecretsExpiredError(id, phase);
    }

    if (progress.kind !== 'claimed') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${id} was already answered. Its secrets can no longer be redeemed.`,
      );
    }

    if (!progress.by.equals(host)) {
      throw new NotThisHostsCallError(id);
    }

    if (secretsClaim.isRedeemed) {
      throw new CallSecretsRedeemedError(id);
    }

    return this.with({ secretsClaim: secretsClaim.redeemed(now) });
  }

  recordResponse(
    host: CallingHost,
    response: NetworkResponse,
    now: Date,
  ): NetworkCall {
    const { progress } = this.state;
    const phase = this.stateAt(now);

    if (phase === 'answered') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} was already answered.`,
      );
    }

    if (phase === 'cancelled') {
      throw new InvalidNetworkCallTransitionError(
        cancelledMessage(this.state.id.value),
      );
    }

    if (phase === 'expired') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} expired before it was answered.`,
      );
    }

    if (progress.kind !== 'claimed') {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} is not claimed by a host yet.`,
      );
    }

    if (!progress.by.equals(host)) {
      throw new NotThisHostsCallError(this.state.id.value);
    }

    return this.with({
      request: this.state.request.spent(),
      progress: {
        kind: 'answered',
        by: progress.by,
        claimedAt: progress.at,
        at: now,
        response,
      },
    });
  }

  expire(now: Date): NetworkCall {
    if (this.isCompleted) {
      return this;
    }

    if (!this.isExpiredAt(now)) {
      throw new InvalidNetworkCallTransitionError(
        `Network call ${this.state.id.value} cannot expire before its time is up.`,
      );
    }

    return this.with({
      request: this.state.request.spent(),
      progress: {
        kind: 'expired',
        at: now,
        claimed: this.state.progress.kind === 'claimed',
      },
    });
  }

  cancel(now: Date): NetworkCall {
    if (this.isCompleted) {
      return this;
    }

    return this.with({
      request: this.state.request.spent(),
      progress: {
        kind: 'cancelled',
        at: now,
        claimed: this.state.progress.kind === 'claimed',
      },
    });
  }

  private isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.state.expiresAt.getTime();
  }

  private with(part: Partial<State>): NetworkCall {
    const next = new NetworkCall({ ...this.state, ...part }, this.isDiscarded);

    next.inheritEvents(this);

    return next;
  }
}
