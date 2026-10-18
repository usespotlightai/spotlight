export class InboxAsk {
  private constructor(
    readonly stationId: string,
    readonly at: Date,
  ) {}

  static of(stationId: string, at: Date): InboxAsk {
    return new InboxAsk(stationId, at);
  }

  equals(other: InboxAsk): boolean {
    return (
      this.stationId === other.stationId &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
