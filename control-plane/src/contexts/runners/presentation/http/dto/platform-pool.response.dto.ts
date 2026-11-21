import { ApiProperty } from '@nestjs/swagger';

export class WorkspacePlatformPoolResponseDto {
  @ApiProperty({
    example: false,
    description:
      'The platform pool takes work of the workspace that no other pool or host of the workspace fits. It stays so across restarts of Spotlight',
  })
  readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }
}
