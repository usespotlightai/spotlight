import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListIntegrationResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
