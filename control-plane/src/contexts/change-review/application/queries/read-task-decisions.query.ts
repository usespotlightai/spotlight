export class ReadTaskDecisionsQuery {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
