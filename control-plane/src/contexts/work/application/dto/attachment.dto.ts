export interface AttachmentDto {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface AttachmentUploadDto {
  readonly id: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}
