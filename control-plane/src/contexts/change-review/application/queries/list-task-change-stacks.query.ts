export class ListTaskChangeStacksQuery {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
