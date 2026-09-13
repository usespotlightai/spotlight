export class PinConfigurationCommand {
  constructor(
    readonly teamId: string,
    readonly repository: string | null,
    readonly viewerId: string,
  ) {}
}
