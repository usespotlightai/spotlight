export class DeleteLineCommand {
  constructor(
    readonly lineId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
