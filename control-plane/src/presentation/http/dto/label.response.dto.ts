import { ApiProperty } from '@nestjs/swagger';

export class LabelResponseDto {
  @ApiProperty({ example: 'f2b1c9d4-3e57-4a80-9c62-1d8e5f0a7b34' })
  readonly id: string;

  @ApiProperty({ example: 'team_platform' })
  readonly teamId: string;

  @ApiProperty({ example: 'Bug' })
  readonly name: string;

  @ApiProperty({ example: '#e11d48', description: 'Six digit hex colour' })
  readonly colour: string;

  constructor(id: string, teamId: string, name: string, colour: string) {
    this.id = id;
    this.teamId = teamId;
    this.name = name;
    this.colour = colour;
  }
}
