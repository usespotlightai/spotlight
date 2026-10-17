import type { ExportableKind } from '@configuration/application/dto/exportable-configuration.dto';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ResourceConfigurationQuery {
  constructor(
    readonly kind: ExportableKind,
    readonly id: string,
    readonly principal: Principal,
  ) {}
}
