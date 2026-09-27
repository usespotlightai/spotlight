export class ReadInboxAsideCommand {
  constructor(
    readonly asideId: string,
    readonly readBy: string,
  ) {}
}
