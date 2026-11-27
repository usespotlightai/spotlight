export class ListGitHubInstallationsQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
  ) {}
}
