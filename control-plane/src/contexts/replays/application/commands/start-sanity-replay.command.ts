import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class StartSanityReplayCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly model: string | null,
    readonly effort: string | null,
    readonly ceiling: { readonly amount: number; readonly currency: string },
    readonly repeats: number,
    readonly actor: Actor,
  ) {}
}
