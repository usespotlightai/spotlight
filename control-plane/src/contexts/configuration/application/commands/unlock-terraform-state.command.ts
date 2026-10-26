import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class UnlockTerraformStateCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly principal: Principal,
    readonly info: unknown | null,
  ) {}
}
