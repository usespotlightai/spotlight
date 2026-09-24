import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadWorkspaceTokenQuery {
  constructor(
    readonly tokenId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportWorkspaceTokenQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListWorkspaceTokenResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
