import { ApiProperty } from '@nestjs/swagger';

export class WorkspacePlatformPoolResponseDto {
  @ApiProperty({
    example: false,
    description:
      'The platform pool takes the work of the workspace. It stays so across restarts of Spotlight',
  })
  readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }
}
