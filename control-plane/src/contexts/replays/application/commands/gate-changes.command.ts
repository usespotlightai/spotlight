import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class GateChangesCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly gates: boolean,
    readonly actor: Actor,
  ) {}
}
