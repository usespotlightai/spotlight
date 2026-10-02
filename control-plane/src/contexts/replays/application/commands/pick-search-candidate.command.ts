import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class PickSearchCandidateCommand {
  constructor(
    readonly teamId: string,
    readonly searchId: string,
    readonly candidateId: string,
    readonly actor: Actor,
  ) {}
}
