import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class WriteTerraformStateCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly principal: Principal,
    readonly lockId: string | null,
    readonly body: Uint8Array,
    readonly md5: string,
  ) {}
}
