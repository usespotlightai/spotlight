import { ApiProperty } from '@nestjs/swagger';

export class RunAttachmentResponseDto {
  @ApiProperty({ example: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47' })
  readonly id: string;

  @ApiProperty({
    example:
      '.spotlight/attachments/5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47/queue-stuck.png',
    description: 'Where in the working copy to put it',
  })
  readonly path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

export class PendingMessageResponseDto {
  @ApiProperty({ example: 4 })
  readonly position: number;

  @ApiProperty({ example: 'Cap the retries at 500 while you are in there.' })
  readonly body: string;

  @ApiProperty({
    type: RunAttachmentResponseDto,
    isArray: true,
    description: 'Files to lay out before the words are sent',
  })
  readonly attachments: readonly RunAttachmentResponseDto[];

  constructor(
    position: number,
    body: string,
    attachments: readonly RunAttachmentResponseDto[],
  ) {
    this.position = position;
    this.body = body;
    this.attachments = attachments;
  }
}
