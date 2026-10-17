import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadRunnerTrustQuery {
  constructor(
    readonly trustId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportRunnerTrustQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ReadWorkspaceRunnersQuery {
  constructor(
    readonly declarationId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportWorkspaceRunnersQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListRunnerTrustResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}

export class ListWorkspaceRunnersResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}

export class ReadRunnerPoolQuery {
  constructor(
    readonly poolId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportRunnerPoolQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListRunnerPoolResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}

export class ReadEgressQuery {
  constructor(
    readonly egressId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportEgressQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListEgressResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
