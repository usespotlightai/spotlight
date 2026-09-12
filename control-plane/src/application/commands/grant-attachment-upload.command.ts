export class GrantAttachmentUploadCommand {
  constructor(
    readonly slug: string,
    readonly uploadedBy: string,
    readonly name: string,
    readonly contentType: string,
    readonly size: number,
  ) {}
}
