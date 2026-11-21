import { ApiProperty } from '@nestjs/swagger';

export class SetWorkspacePlatformPoolRequestDto {
  @ApiProperty({
    example: false,
    description:
      'True to let the platform pool take the work of the workspace that no other pool or host fits, false to disable it for this workspace',
  })
  readonly enabled!: boolean;
}
