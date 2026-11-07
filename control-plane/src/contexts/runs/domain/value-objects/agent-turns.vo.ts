export interface TimeSpan {
  readonly from: number;
  readonly to: number;
}

export class AgentTurns {
  private constructor(private readonly spans: readonly TimeSpan[]) {}

  static of(
    updatedAt: readonly Date[],
    pausedAt: readonly Date[],
  ): AgentTurns | null {
    if (updatedAt.length === 0) {
      return null;
    }

    const pauses = pausedAt.map((at) => at.getTime()).sort((a, b) => a - b);
    const turns = new Map<number, TimeSpan>();

    for (const at of updatedAt.map((each) => each.getTime())) {
      const turn = pauses.filter((pause) => pause < at).length;
      const span = turns.get(turn);

      turns.set(turn, {
        from: Math.min(span?.from ?? at, at),
        to: Math.max(span?.to ?? at, at),
      });
    }

    return new AgentTurns([...turns.values()]);
  }

  get ms(): number {
    return this.spans.reduce((sum, span) => sum + span.to - span.from, 0);
  }

  workingWithin(within: TimeSpan): number {
    return this.spans.reduce(
      (sum, span) =>
        sum +
        Math.max(
          0,
          Math.min(span.to, within.to) - Math.max(span.from, within.from),
        ),
      0,
    );
  }
}
