import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadIntegrationQuery {
  constructor(
    readonly integrationId: string,
    readonly principal: Principal,
  ) {}
}
