import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadRunnerQuery {
  constructor(
    readonly runnerId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportRunnerQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

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

export class ListRunnerResourcesQuery {
  constructor(
    readonly workspaceId: string,
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
