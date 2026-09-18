export class ListTeamTracesQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly since: Date,
  ) {}
}
