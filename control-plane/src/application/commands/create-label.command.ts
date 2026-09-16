export class CreateLabelCommand {
  constructor(
    readonly teamId: string,
    readonly name: string,
    readonly colour: string,
    readonly viewerId: string,
  ) {}
}
