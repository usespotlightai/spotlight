import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class LockTerraformStateCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly principal: Principal,
    readonly info: unknown,
  ) {}
}
