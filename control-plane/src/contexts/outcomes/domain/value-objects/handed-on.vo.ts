export class HandedOn {
  private constructor(
    readonly to: string,
    readonly at: Date,
  ) {}

  static of(to: string, at: Date): HandedOn {
    return new HandedOn(to, at);
  }
}
