export class GetWorkspaceQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
  ) {}
}
