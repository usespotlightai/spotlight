import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class ProposeCandidateCommand {
  constructor(
    readonly lineId: string,
    readonly stationKey: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
