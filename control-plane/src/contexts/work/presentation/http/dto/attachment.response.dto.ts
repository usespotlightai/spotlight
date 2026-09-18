import { ApiProperty } from '@nestjs/swagger';

export class AttachmentResponseDto {
  @ApiProperty({ example: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47' })
  readonly id: string;

  @ApiProperty({ example: 'queue-stuck.png' })
  readonly name: string;

  @ApiProperty({ example: 'image/png' })
  readonly contentType: string;

  @ApiProperty({ example: 48213, description: 'In bytes' })
  readonly size: number;

  constructor(id: string, name: string, contentType: string, size: number) {
    this.id = id;
    this.name = name;
    this.contentType = contentType;
    this.size = size;
  }
}

export class AttachmentUploadResponseDto {
  @ApiProperty({
    example: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
    description: 'What to attach it by, once it is uploaded',
  })
  readonly id: string;

  @ApiProperty({
    example: 'https://files.example.com/…',
    description: 'Where to PUT the bytes. Good for a few minutes.',
  })
  readonly url: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'content-type': 'image/png' },
    description: 'Sent with the bytes, exactly as given',
  })
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    id: string,
    url: string,
    headers: Readonly<Record<string, string>>,
  ) {
    this.id = id;
    this.url = url;
    this.headers = headers;
  }
}
