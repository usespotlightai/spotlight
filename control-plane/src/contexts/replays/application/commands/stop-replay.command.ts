import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class StopReplayCommand {
  constructor(
    readonly teamId: string,
    readonly replayId: string,
    readonly actor: Actor,
  ) {}
}
