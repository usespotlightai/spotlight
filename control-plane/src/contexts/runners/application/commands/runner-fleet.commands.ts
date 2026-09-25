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
