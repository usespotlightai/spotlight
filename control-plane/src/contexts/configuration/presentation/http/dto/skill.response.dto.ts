import type {
  TeamSkillDto,
  TeamSkillsDto,
} from '@configuration/application/dto/skills.dto';
import { ApiProperty } from '@nestjs/swagger';

class TeamSkillResponseDto {
  @ApiProperty({ example: 'grafana-dashboards' })
  readonly key: string;

  @ApiProperty({ example: 'Reading this team’s dashboards.' })
  readonly description: string;

  @ApiProperty({
    example: '.spotlight/skills/grafana-dashboards',
    description: 'Where the skill is defined',
  })
  readonly path: string;

  constructor(dto: TeamSkillDto) {
    this.key = dto.key;
    this.description = dto.description;
    this.path = dto.path;
  }
}

export class TeamSkillsResponseDto {
  @ApiProperty({ type: [TeamSkillResponseDto] })
  readonly skills: TeamSkillResponseDto[];

  constructor(dto: TeamSkillsDto) {
    this.skills = dto.skills.map((each) => new TeamSkillResponseDto(each));
  }
}
