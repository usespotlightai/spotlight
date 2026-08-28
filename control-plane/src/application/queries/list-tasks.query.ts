export class ListTasksQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
  ) {}
}
