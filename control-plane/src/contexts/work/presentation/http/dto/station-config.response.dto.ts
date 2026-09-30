import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfigChangeShape,
  StationConfigShape,
} from '@work/application/contracts/station-config.contract';

export class ConfiguredProfileResponseDto {
  @ApiProperty({ example: 'careful' })
  readonly key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The permissions, MCP servers and native settings it held',
  })
  readonly settings: Record<string, unknown>;

  constructor(from: { key: string; settings: unknown }) {
    this.key = from.key;
    this.settings =
      from.settings !== null && typeof from.settings === 'object'
        ? (from.settings as Record<string, unknown>)
        : {};
  }
}

export class ConfiguredRepositoryResponseDto {
  @ApiProperty({ example: 'api' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String, example: 'npm ci' })
  readonly setup: string | null;

  constructor(from: { name: string; setup: string | null }) {
    this.name = from.name;
    this.setup = from.setup;
  }
}

export class ConfiguredSkillResponseDto {
  @ApiProperty({ example: 'reviewing' })
  readonly key: string;

  @ApiProperty({ description: "The SHA-256 of the skill's files" })
  readonly digest: string;

  constructor(from: { key: string; digest: string }) {
    this.key = from.key;
    this.digest = from.digest;
  }
}

export class StationConfigResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly prompt: string | null;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ nullable: true, type: String, example: 'claude-opus-5-5' })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ nullable: true, type: () => ConfiguredProfileResponseDto })
  readonly profile: ConfiguredProfileResponseDto | null;

  @ApiProperty({ nullable: true, type: String, example: 'ghcr.io/acme/api:1' })
  readonly image: string | null;

  @ApiProperty({ type: () => [ConfiguredRepositoryResponseDto] })
  readonly repositories: ConfiguredRepositoryResponseDto[];

  @ApiProperty({ type: () => [ConfiguredSkillResponseDto] })
  readonly skills: ConfiguredSkillResponseDto[];

  @ApiProperty({ type: [String], example: ['pull-request'] })
  readonly tools: string[];

  @ApiProperty()
  readonly decisions: boolean;

  @ApiProperty()
  readonly memories: boolean;

  constructor(from: StationConfigShape) {
    this.prompt = from.prompt;
    this.harness = from.harness;
    this.model = from.model;
    this.effort = from.effort;
    this.profile = from.profile
      ? new ConfiguredProfileResponseDto(from.profile)
      : null;
    this.image = from.image;
    this.repositories = from.repositories.map(
      (each) => new ConfiguredRepositoryResponseDto(each),
    );
    this.skills = from.skills.map(
      (each) => new ConfiguredSkillResponseDto(each),
    );
    this.tools = [...from.tools];
    this.decisions = from.decisions;
    this.memories = from.memories;
  }
}

const PARTS = [
  'prompt',
  'harness',
  'model',
  'effort',
  'profile',
  'image',
  'repository',
  'skill',
  'tool',
  'decisions',
  'memories',
];

export class ConfigChangeResponseDto {
  @ApiProperty({ enum: PARTS, example: 'effort' })
  readonly part: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The repository, skill or tool changed, where the part has several',
  })
  readonly name: string | null;

  @ApiProperty({ enum: ['added', 'removed', 'changed'], example: 'changed' })
  readonly kind: string;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly was: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'xhigh' })
  readonly now: string | null;

  constructor(from: ConfigChangeShape) {
    this.part = from.part;
    this.name = from.name;
    this.kind = from.kind;
    this.was = from.was;
    this.now = from.now;
  }
}
