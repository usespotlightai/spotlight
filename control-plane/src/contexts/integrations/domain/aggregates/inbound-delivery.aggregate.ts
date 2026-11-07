import { InvalidInboundDeliveryTransitionError } from '@integrations/domain/exceptions/invalid-inbound-delivery-transition.error';
import { DELIVERING } from '@integrations/domain/services/delivery-retry';
import type { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { InboundDeliveryId } from '@integrations/domain/value-objects/inbound-delivery-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface DeliveryAddressee {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly teamKey: string;
}

export type DeliveryHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export type InboundDeliveryProgress =
  | { readonly kind: 'pending'; readonly dueAt: Date }
  | { readonly kind: 'working'; readonly claimedAt: Date }
  | { readonly kind: 'done'; readonly at: Date }
  | { readonly kind: 'failed'; readonly at: Date };

export type InboundDeliveryState = InboundDeliveryProgress['kind'];

export const INBOUND_DELIVERY_STATES = [
  'pending',
  'working',
  'done',
  'failed',
] as const satisfies readonly InboundDeliveryState[];

interface Received {
  readonly integration: IntegrationKey;
  readonly to: DeliveryAddressee | null;
  readonly id: InboundDeliveryId;
  readonly headers: DeliveryHeaders;
  readonly body: unknown;
  readonly causeFiringId: HookFiringId | null;
}

interface State extends Received {
  readonly receivedAt: Date;
  readonly progress: InboundDeliveryProgress;
  readonly attempts: number;
  readonly failure: string | null;
  readonly version: number;
}

const LEASE_MS = 10 * 60 * 1000;

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class InboundDelivery {
  private constructor(private readonly state: State) {}

  static receive(input: Received, now: Date): InboundDelivery {
    return new InboundDelivery({
      ...input,
      headers: deepFrozen(structuredClone(input.headers)),
      receivedAt: now,
      progress: { kind: 'pending', dueAt: now },
      attempts: 0,
      failure: null,
      version: 0,
    });
  }

  static rehydrate(state: State): InboundDelivery {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InconsistentStateError(
        'inbound delivery',
        `has an impossible version (${state.version})`,
      );
    }

    if (!Number.isInteger(state.attempts) || state.attempts < 0) {
      throw new InconsistentStateError(
        'inbound delivery',
        `was attempted ${state.attempts} times`,
      );
    }

    if (state.progress.kind === 'failed' && state.failure === null) {
      throw new InconsistentStateError(
        'inbound delivery',
        `failed for no reason (${state.id.value})`,
      );
    }

    return new InboundDelivery(state);
  }

  static leaseExpiredBefore(now: Date): Date {
    return new Date(now.getTime() - LEASE_MS);
  }

  static retentionCutoff(now: Date): Date {
    return new Date(now.getTime() - RETENTION_MS);
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get to(): DeliveryAddressee | null {
    return this.state.to;
  }

  get id(): InboundDeliveryId {
    return this.state.id;
  }

  get receivedAs(): string {
    const { integration, to, id } = this.state;

    return `delivery:${integration.value}:${to?.teamId.value ?? ''}:${id.value}`;
  }

  get headers(): DeliveryHeaders {
    return this.state.headers;
  }

  get body(): unknown {
    return this.state.body;
  }

  get causeFiringId(): HookFiringId | null {
    return this.state.causeFiringId;
  }

  get receivedAt(): Date {
    return this.state.receivedAt;
  }

  get progress(): InboundDeliveryProgress {
    return this.state.progress;
  }

  get attempts(): number {
    return this.state.attempts;
  }

  get failure(): string | null {
    return this.state.failure;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get gaveUp(): boolean {
    return this.state.progress.kind === 'failed';
  }

  isClaimableAt(now: Date): boolean {
    const { progress } = this.state;

    if (progress.kind === 'pending') {
      return progress.dueAt.getTime() <= now.getTime();
    }

    return (
      progress.kind === 'working' &&
      progress.claimedAt.getTime() <
        InboundDelivery.leaseExpiredBefore(now).getTime()
    );
  }

  claimed(now: Date): InboundDelivery {
    const { progress } = this.state;

    if (!this.isClaimableAt(now)) {
      throw new InvalidInboundDeliveryTransitionError(
        progress.kind === 'working'
          ? 'is still claimed'
          : `cannot be claimed while ${progress.kind}`,
      );
    }

    return this.with({ progress: { kind: 'working', claimedAt: now } });
  }

  worked(now: Date): InboundDelivery {
    this.guardWorking('be worked');

    return this.with({
      progress: { kind: 'done', at: now },
      attempts: this.state.attempts + 1,
    });
  }

  failedWith(failure: DeliveryFailure, now: Date): InboundDelivery {
    this.guardWorking('fail');

    const attempts = this.state.attempts + 1;
    const again = failure.transient
      ? DELIVERING.nextAttemptAt(attempts, now)
      : null;

    return this.with({
      progress: again
        ? { kind: 'pending', dueAt: again }
        : { kind: 'failed', at: now },
      attempts,
      failure: failure.reason,
    });
  }

  isPastRetention(now: Date): boolean {
    const { progress } = this.state;

    return (
      (progress.kind === 'done' || progress.kind === 'failed') &&
      progress.at.getTime() + RETENTION_MS <= now.getTime()
    );
  }

  private guardWorking(doing: string): void {
    const { kind } = this.state.progress;

    if (kind !== 'working') {
      throw new InvalidInboundDeliveryTransitionError(
        `cannot ${doing} while ${kind}`,
      );
    }
  }

  private with(part: Partial<State>): InboundDelivery {
    return new InboundDelivery({ ...this.state, ...part });
  }
}
