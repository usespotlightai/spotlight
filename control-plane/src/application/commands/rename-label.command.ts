export class RenameLabelCommand {
  constructor(
    readonly teamId: string,
    readonly labelId: string,
    readonly name: string,
    readonly viewerId: string,
  ) {}
}
