import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

class SkillSecretResponseDto {
  @ApiProperty({ example: 'GRAFANA_TOKEN' })
  readonly name: string;

  @ApiProperty({ example: 'A read-only token its tools use' })
  readonly description: string;

  constructor(secret: { name: string; description: string }) {
    this.name = secret.name;
    this.description = secret.description;
  }
}

export class SkillResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'grafana',
    description:
      'What stations enable it by. Immutable: changing it means replacing the skill',
  })
  readonly key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'SKILL.md':
        '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch before you guess.',
    },
    description:
      'Each file in the skill’s folder, by its path within it; SKILL.md is the one the skill is read from',
  })
  readonly files: Readonly<Record<string, string>>;

  @ApiProperty({
    example: 'Look up dashboards',
    description: 'What SKILL.md says it is for; not settable',
  })
  readonly description: string;

  @ApiProperty({
    type: SkillSecretResponseDto,
    isArray: true,
    description: 'The secrets SKILL.md requires; not settable',
  })
  readonly secrets: readonly SkillSecretResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['grafana.search'],
    description: 'The tools SKILL.md uses; not settable',
  })
  readonly tools: readonly string[];

  constructor(skill: SkillResourceDto) {
    super(skill);
    this.teamId = skill.teamId;
    this.key = skill.key;
    this.files = skill.files;
    this.description = skill.description;
    this.secrets = skill.secrets.map(
      (each) => new SkillSecretResponseDto(each),
    );
    this.tools = skill.tools;
  }
}
