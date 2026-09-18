export interface LineSetup {
  readonly key: string;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repositories: readonly string[];
}

export class SetUpLinesCommand {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly lines: readonly LineSetup[],
  ) {}
}
