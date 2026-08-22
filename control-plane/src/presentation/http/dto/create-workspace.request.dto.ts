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
}
