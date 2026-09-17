export class ListTeamRunsQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
  ) {}
}
