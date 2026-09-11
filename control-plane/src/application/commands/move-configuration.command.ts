export class MoveConfigurationCommand {
  constructor(
    readonly teamId: string,
    readonly repository: string,
    readonly viewerId: string,
  ) {}
}
