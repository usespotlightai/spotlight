import { ApiProperty } from '@nestjs/swagger';

export class HostHeartbeatResponseDto {
  @ApiProperty({
    example: '9b1d4c7e-2a3f-4e5d-8c6b-7a8f9e0d1c2b',
    description:
      'The workspace the host serves, which it keeps its mirrors under',
  })
  readonly workspace: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['5d2e8f1a-7c4b-4e9a-b3f6-1a8d0c7e2b95'],
    description:
      'The reported sandboxes to drain: the host stops each one with a grace period, then destroys it',
  })
  readonly drain: string[];

  constructor(workspace: string, drain: readonly string[]) {
    this.workspace = workspace;
    this.drain = [...drain];
  }
}
