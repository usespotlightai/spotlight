import type { TeamSkillDto, TeamSkillsDto } from '@application/dto/skills.dto';
import { ApiProperty } from '@nestjs/swagger';

class TeamSkillResponseDto {
  @ApiProperty({ example: 'grafana-dashboards' })
  readonly key: string;

  @ApiProperty({ example: 'Reading this team’s dashboards.' })
  readonly description: string;

  @ApiProperty({
    example: '.spotlight/skills/grafana-dashboards',
    description: 'Its folder in the configuration repository',
  })
  readonly path: string;

  constructor(dto: TeamSkillDto) {
    this.key = dto.key;
    this.description = dto.description;
    this.path = dto.path;
  }
}

export class TeamSkillsResponseDto {
  @ApiProperty({
    example: 'acme/config',
    nullable: true,
    type: String,
    description: 'Where the skills were read from',
  })
  readonly repository: string | null;

  @ApiProperty({ type: [TeamSkillResponseDto] })
  readonly skills: TeamSkillResponseDto[];

  constructor(dto: TeamSkillsDto) {
    this.repository = dto.repository;
    this.skills = dto.skills.map((each) => new TeamSkillResponseDto(each));
  }
}
