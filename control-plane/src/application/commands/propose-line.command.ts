export class ProposeLineCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly viewerId: string,
  ) {}
}
