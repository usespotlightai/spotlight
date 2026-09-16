export class DeleteLabelCommand {
  constructor(
    readonly teamId: string,
    readonly labelId: string,
    readonly viewerId: string,
  ) {}
}
