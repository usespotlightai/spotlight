export class EnrolRunnerCommand {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly name: string,
  ) {}
}

export interface RegisteredHarness {
  readonly id: string;
  readonly models: readonly string[];
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
    readonly viewerId: string,
    readonly runnerId: string,
  ) {}
}
