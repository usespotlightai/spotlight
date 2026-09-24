import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListWorkspaceResourcesQuery {
  constructor(readonly principal: Principal) {}
}
