import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadInferenceEndpointQuery {
  constructor(
    readonly inferenceEndpointId: string,
    readonly principal: Principal,
  ) {}
}

export class ImportInferenceEndpointQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}

export class ListInferenceEndpointResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
