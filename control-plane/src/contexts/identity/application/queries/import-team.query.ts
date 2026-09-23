export class ImportTeamQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
