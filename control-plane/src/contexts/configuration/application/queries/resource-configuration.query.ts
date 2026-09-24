import type { HeldKind } from '@configuration/application/dto/held-configuration.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ResourceConfigurationQuery {
  constructor(
    readonly kind: HeldKind,
    readonly id: string,
    readonly principal: Principal,
  ) {}
}
