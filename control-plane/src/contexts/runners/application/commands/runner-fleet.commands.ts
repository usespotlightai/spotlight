import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class EnrolRunnerCommand {
  constructor(
    readonly slug: string,
    readonly actor: Actor,
    readonly name: string,
  ) {}
}

export interface RegisteredHarness {
  readonly id: string;
  readonly models: readonly string[];
  readonly version?: string;
}

export class RegisterRunnerCommand {
  constructor(
    readonly runnerId: string,
    readonly harnesses: readonly RegisteredHarness[],
  ) {}
}

export class RevokeRunnerCommand {
  constructor(
    readonly slug: string,
    readonly actor: Actor,
    readonly runnerId: string,
  ) {}
}
