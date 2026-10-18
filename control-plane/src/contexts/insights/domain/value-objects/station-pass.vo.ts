export class StationPass {
  private constructor(
    readonly to: string,
    readonly at: Date,
  ) {}

  static of(to: string, at: Date): StationPass {
    return new StationPass(to, at);
  }
}
