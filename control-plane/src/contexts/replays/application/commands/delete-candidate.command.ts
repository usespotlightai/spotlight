import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteCandidateCommand {
  constructor(
    readonly candidateId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
