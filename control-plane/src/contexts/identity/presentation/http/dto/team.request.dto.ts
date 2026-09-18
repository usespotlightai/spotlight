import { ApiProperty } from '@nestjs/swagger';

export class RenameTeamRequestDto {
  @ApiProperty({
    description: 'What the team is called.',
    example: 'Platform',
  })
  readonly name!: string;
}
