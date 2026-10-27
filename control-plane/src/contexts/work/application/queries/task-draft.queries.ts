export class JoinTaskDraftQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}

export class ReadTaskDraftQuery {
  constructor(readonly taskId: string) {}
}
