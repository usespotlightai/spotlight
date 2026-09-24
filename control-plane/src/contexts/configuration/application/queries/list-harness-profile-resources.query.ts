import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListHarnessProfileResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
