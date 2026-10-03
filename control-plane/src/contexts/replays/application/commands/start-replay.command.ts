import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class StartReplayCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly candidate: string,
    readonly ceiling: { readonly amount: number; readonly currency: string },
    readonly repeats: number,
    readonly probe: boolean,
    readonly actor: Actor,
  ) {}
}
