export class ListUserEmailsQuery {
  constructor(
    readonly viewerId: string,
    readonly viewerEmail: string,
  ) {}
}
