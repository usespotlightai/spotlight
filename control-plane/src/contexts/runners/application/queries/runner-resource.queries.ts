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
