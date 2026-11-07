import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UnlockTerraformStateCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly actor: Actor,
    readonly force: boolean,
    readonly info: unknown,
  ) {}
}
