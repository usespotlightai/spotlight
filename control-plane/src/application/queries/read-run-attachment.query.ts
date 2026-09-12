export class ReadRunAttachmentQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly attachmentId: string,
  ) {}
}
