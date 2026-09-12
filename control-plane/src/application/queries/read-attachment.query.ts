export class ReadAttachmentQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly attachmentId: string,
    readonly download: boolean,
  ) {}
}
