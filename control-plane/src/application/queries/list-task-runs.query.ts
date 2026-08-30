export class ListTaskRunsQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
