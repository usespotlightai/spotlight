import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class TeamResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
    description: 'The workspace it belongs to',
  })
  readonly workspaceId: string;

  @ApiProperty({
    example: 'core',
    description:
      'Names the team in the addresses of everything it has; fixed for its life, so changing it means replacing the team',
  })
  readonly key: string;

  @ApiProperty({ example: 'Core', description: 'What the team is called' })
  readonly name: string;

  constructor(team: TeamResourceDto) {
    super(team);
    this.workspaceId = team.workspaceId;
    this.key = team.key;
    this.name = team.name;
  }
}
