import { ApiPropertyOptional } from '@nestjs/swagger';

// Give at least one field. A field that is not given stays as it is.
export class SetWorkspacePlatformPoolRequestDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'True to let the platform pool take the work of the workspace that no other pool or host fits, false to disable it for this workspace',
  })
  readonly enabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'True to let the platform pool take runs that inject secrets or a Spotlight token. Their traffic goes through the egress of the deployment. False by default',
  })
  readonly allowsSecrets?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'True to let the platform pool take checks and diffs, which pushes start with no person asking. False by default',
  })
  readonly allowsReviewWork?: boolean;
}
