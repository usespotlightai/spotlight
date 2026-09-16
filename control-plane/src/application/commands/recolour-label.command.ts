export class RecolourLabelCommand {
  constructor(
    readonly teamId: string,
    readonly labelId: string,
    readonly colour: string,
    readonly viewerId: string,
  ) {}
}
