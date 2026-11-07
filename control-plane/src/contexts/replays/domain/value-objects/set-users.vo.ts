export interface SetSearchUse {
  readonly isActive: boolean;
}

export interface SetReplayUse {
  readonly isInProgress: boolean;
}

export interface SetCheckUse {
  readonly awaitsBaseline: boolean;
}

export class SetUsers {
  private constructor(
    private readonly searches: readonly SetSearchUse[],
    private readonly replays: readonly SetReplayUse[],
    private readonly checks: readonly SetCheckUse[],
  ) {}

  static of(input: {
    searches: readonly SetSearchUse[];
    replays: readonly SetReplayUse[];
    checks: readonly SetCheckUse[];
  }): SetUsers {
    return new SetUsers(
      [...input.searches],
      [...input.replays],
      [...input.checks],
    );
  }

  static none(): SetUsers {
    return new SetUsers([], [], []);
  }

  get inUse(): boolean {
    return (
      this.searches.some((each) => each.isActive) ||
      this.replays.some((each) => each.isInProgress) ||
      this.checks.some((each) => each.awaitsBaseline)
    );
  }
}
