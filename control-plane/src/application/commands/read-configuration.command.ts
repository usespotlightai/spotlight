export class ReadConfigurationCommand {
  constructor(
    readonly teamId: string,
    /** Who asked. A workspace's configuration is its members' to read. */
    readonly viewerId: string,
  ) {}
}
