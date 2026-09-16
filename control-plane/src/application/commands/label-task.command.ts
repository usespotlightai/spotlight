export class LabelTaskCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly labelId: string,
    readonly viewerId: string,
  ) {}
}
