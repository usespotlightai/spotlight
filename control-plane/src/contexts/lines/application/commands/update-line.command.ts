import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UpdateLineCommand {
  constructor(
    readonly lineId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
