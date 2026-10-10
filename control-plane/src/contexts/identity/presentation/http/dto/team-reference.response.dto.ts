import { ApiProperty } from '@nestjs/swagger';

export class TeamReferenceResponseDto {
  @ApiProperty({ example: 'team_1' })
  readonly id!: string;

  @ApiProperty({ example: 'Platform' })
  readonly name!: string;
}
