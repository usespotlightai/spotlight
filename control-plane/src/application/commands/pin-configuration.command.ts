export class PinConfigurationCommand {
  constructor(
    readonly teamId: string,
    /** Null takes the pin off, and the fallback rule applies again. */
    readonly repository: string | null,
    readonly viewerId: string,
  ) {}
}
