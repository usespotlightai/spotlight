export class KeepTaskDraftCommand {
  constructor(
    readonly taskId: string,
    readonly state: Uint8Array,
  ) {}
}
