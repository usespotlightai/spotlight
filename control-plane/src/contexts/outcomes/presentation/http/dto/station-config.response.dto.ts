import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfigPart,
  StationConfigView,
} from '@outcomes/application/ports/work.port';

export class ConfigProfileResponseDto {
  @ApiProperty({ example: 'careful-claude' })
  readonly key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'The settings the profile gave the harness',
  })
  readonly settings: unknown;

  constructor(profile: { key: string; settings: unknown }) {
    this.key = profile.key;
    this.settings = profile.settings;
  }
}

export class ConfigRepositoryResponseDto {
  @ApiProperty({ example: 'acme/api' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String, example: 'npm ci' })
  readonly setup: string | null;

  constructor(repository: { name: string; setup: string | null }) {
    this.name = repository.name;
    this.setup = repository.setup;
  }
}

export class ConfigSkillResponseDto {
  @ApiProperty({ example: 'write-tests' })
  readonly key: string;

  @ApiProperty({
    example: '9f2c1e…',
    description: 'The digest of the skill’s content the run was given',
  })
  readonly digest: string;

  constructor(skill: { key: string; digest: string }) {
    this.key = skill.key;
    this.digest = skill.digest;
  }
}

export class StationConfigResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly prompt: string | null;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ nullable: true, type: String, example: 'opus' })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ type: ConfigProfileResponseDto, nullable: true })
  readonly profile: ConfigProfileResponseDto | null;

  @ApiProperty({ nullable: true, type: String, example: 'node:22' })
  readonly image: string | null;

  @ApiProperty({ type: ConfigRepositoryResponseDto, isArray: true })
  readonly repositories: readonly ConfigRepositoryResponseDto[];

  @ApiProperty({ type: ConfigSkillResponseDto, isArray: true })
  readonly skills: readonly ConfigSkillResponseDto[];

  @ApiProperty({ type: String, isArray: true, example: ['github.comment'] })
  readonly tools: readonly string[];

  @ApiProperty({ description: 'Whether its runs record their decisions' })
  readonly decisions: boolean;

  @ApiProperty({ description: 'Whether its runs keep memories' })
  readonly memories: boolean;

  constructor(config: StationConfigView) {
    this.prompt = config.prompt;
    this.harness = config.harness;
    this.model = config.model;
    this.effort = config.effort;
    this.profile = config.profile
      ? new ConfigProfileResponseDto(config.profile)
      : null;
    this.image = config.image;
    this.repositories = config.repositories.map(
      (each) => new ConfigRepositoryResponseDto(each),
    );
    this.skills = config.skills.map((each) => new ConfigSkillResponseDto(each));
    this.tools = [...config.tools];
    this.decisions = config.decisions;
    this.memories = config.memories;
  }
}

export class ConfigChangeResponseDto {
  @ApiProperty({ example: 'model' })
  readonly part: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'write-tests',
    description: 'Which one of the part changed, where the part is a list',
  })
  readonly name: string | null;

  @ApiProperty({ enum: ['added', 'removed', 'changed'] })
  readonly kind: string;

  @ApiProperty({ nullable: true, type: String, example: 'sonnet' })
  readonly was: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'opus' })
  readonly now: string | null;

  constructor(change: ConfigPart) {
    this.part = change.part;
    this.name = change.name;
    this.kind = change.kind;
    this.was = change.was;
    this.now = change.now;
  }
}
