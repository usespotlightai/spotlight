export class ConnectGitHubCommand {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly installationId: string,
  ) {}
}
