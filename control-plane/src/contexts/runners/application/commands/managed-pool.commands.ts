import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

// For the operator of the deployment. The caller checks that the actor operates the deployment.
export class UpdateManagedPoolCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly disabled: boolean,
  ) {}
}
