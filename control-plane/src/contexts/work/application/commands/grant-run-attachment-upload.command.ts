export class GrantRunAttachmentUploadCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly name: string,
    readonly contentType: string,
    readonly size: number,
  ) {}
}
