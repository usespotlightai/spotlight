import type { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INBOUND_DELIVERIES = Symbol('INBOUND_DELIVERIES');

export interface InboundDeliveryRepository {
  add(delivery: InboundDelivery): Promise<boolean>;

  claimCandidates(now: Date, max: number): Promise<readonly InboundDelivery[]>;

  current(delivery: InboundDelivery): Promise<InboundDelivery | null>;

  addressedTo(teamId: TeamId, max: number): Promise<readonly InboundDelivery[]>;

  finishedBefore(at: Date, max: number): Promise<readonly InboundDelivery[]>;

  save(delivery: InboundDelivery): Promise<void>;

  remove(delivery: InboundDelivery): Promise<void>;
}
