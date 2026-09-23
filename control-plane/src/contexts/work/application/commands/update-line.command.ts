export class UpdateLineCommand {
  constructor(
    readonly lineId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
