export class ReadTaskNotesQuery {
  constructor(
    readonly taskId: string,
    readonly from: number,
    readonly to: number,
    readonly viewerId: string,
  ) {}
}
