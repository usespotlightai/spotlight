import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceRequestDto {
  @ApiProperty({ example: 'Acme Inc.', maxLength: 100 })
  readonly name!: string;

  @ApiProperty({
    example: 'acme-inc',
    maxLength: 48,
    description:
      'Addresses the workspace at /w/{slug}. Lowercase letters, numbers and single dashes.',
  })
  readonly slug!: string;

  @ApiProperty({
    example: 'Platform',
    maxLength: 100,
    description:
      'Names the team the workspace opens with. A workspace with no team has nowhere to put work.',
  })
  readonly teamName!: string;
}
