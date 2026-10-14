export class ListWorkspaceMembersQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
  ) {}
}
