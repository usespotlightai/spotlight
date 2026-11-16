import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateInferenceEndpointCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateInferenceEndpointCommand {
  constructor(
    readonly inferenceEndpointId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteInferenceEndpointCommand {
  constructor(
    readonly inferenceEndpointId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}

export class TestInferenceEndpointCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly definition: unknown,
  ) {}
}
