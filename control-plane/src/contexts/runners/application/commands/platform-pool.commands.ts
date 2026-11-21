import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

// The caller authorises the operator of the deployment, and names who made the change.
export class DisablePlatformPoolCommand {
  constructor(
    readonly workspaceId: string,
    readonly by: ChangeActor,
  ) {}
}

export class EnablePlatformPoolCommand {
  constructor(
    readonly workspaceId: string,
    readonly by: ChangeActor,
  ) {}
}
