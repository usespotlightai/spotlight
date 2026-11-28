export class ListTaskMovesQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
