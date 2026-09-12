export class ListInvitesQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
  ) {}
}
