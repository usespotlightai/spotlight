export class ListMembersQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
  ) {}
}
