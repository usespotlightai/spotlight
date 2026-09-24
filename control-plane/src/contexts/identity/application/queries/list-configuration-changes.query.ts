import type { AuditPage } from '@identity/application/ports/configuration-audit.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListConfigurationChangesQuery {
  constructor(
    readonly slug: string,
    readonly principal: Principal,
    readonly page: AuditPage,
  ) {}
}
