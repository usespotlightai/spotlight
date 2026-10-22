import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadOidcTrustQuery {
  constructor(
    readonly trustId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportOidcTrustQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListOidcTrustResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
