import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadTerraformStateQuery {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly principal: Principal,
  ) {}
}
