import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadWorkspaceTokenTrustQuery {
  constructor(
    readonly trustId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportWorkspaceTokenTrustQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListWorkspaceTokenTrustResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
