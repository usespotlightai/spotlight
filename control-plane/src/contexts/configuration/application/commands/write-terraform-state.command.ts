import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class WriteTerraformStateCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly actor: Actor,
    readonly lockId: string | null,
    readonly body: Uint8Array,
    readonly md5: string,
  ) {}
}
