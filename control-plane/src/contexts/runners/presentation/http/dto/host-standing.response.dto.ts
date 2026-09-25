import { ApiProperty } from '@nestjs/swagger';

export class HostStandingResponseDto {
  @ApiProperty({
    example: '9b1d4c7e-2a3f-4e5d-8c6b-7a8f9e0d1c2b',
    description:
      'The workspace the host serves, which it keeps its mirrors under',
  })
  readonly workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }
}
