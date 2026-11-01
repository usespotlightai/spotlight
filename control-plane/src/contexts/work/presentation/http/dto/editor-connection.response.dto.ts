import { ApiProperty } from '@nestjs/swagger';

export class EditorConnectionResponseDto {
  @ApiProperty({ example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31' })
  readonly sandboxId: string;

  @ApiProperty({
    example: '5d8e2a1c-9f3b-4c7d-a6e0-3b2f1d9c8a74',
    description:
      'The editor lease to name when the socket opens; it expires two minutes after it is held unless a socket renews it',
  })
  readonly holder: string;

  constructor(sandboxId: string, holder: string) {
    this.sandboxId = sandboxId;
    this.holder = holder;
  }
}
