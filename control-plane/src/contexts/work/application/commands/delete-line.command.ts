import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteLineCommand {
  constructor(
    readonly lineId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
