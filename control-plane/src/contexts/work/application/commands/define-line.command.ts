export class DefineLineCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly definition: unknown,
  ) {}
}
