import { ApiProperty } from '@nestjs/swagger';

export class WorkspacePlatformPoolResponseDto {
  @ApiProperty({
    example: false,
    description:
      'The platform pool takes work of the workspace that no other pool or host of the workspace fits. It stays so across restarts of Spotlight',
  })
  readonly enabled: boolean;

  @ApiProperty({
    example: false,
    description:
      'The platform pool takes runs that inject secrets or a Spotlight token',
  })
  readonly allowsSecrets: boolean;

  @ApiProperty({
    example: false,
    description: 'The platform pool takes checks and diffs',
  })
  readonly allowsReviewWork: boolean;

  constructor(
    enabled: boolean,
    allowsSecrets: boolean,
    allowsReviewWork: boolean,
  ) {
    this.enabled = enabled;
    this.allowsSecrets = allowsSecrets;
    this.allowsReviewWork = allowsReviewWork;
  }
}
