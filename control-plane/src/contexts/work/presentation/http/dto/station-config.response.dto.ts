import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfigChangeShape,
  StationConfigShape,
} from '@work/application/contracts/station-config.contract';

export class ProfileViewResponseDto {
  @ApiProperty({ example: 'careful' })
  readonly key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The permissions, MCP servers and native settings it contained',
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

export class RepositoryViewResponseDto {
  @ApiProperty({ example: 'api' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String, example: 'npm ci' })
  readonly setup: string | null;

  constructor(from: { name: string; setup: string | null }) {
    this.name = from.name;
    this.setup = from.setup;
  }
}

export class SkillViewResponseDto {
  @ApiProperty({ example: 'reviewing' })
  readonly key: string;

  @ApiProperty({ description: "The SHA-256 of the skill's files" })
  readonly hash: string;

  constructor(from: { key: string; hash: string }) {
    this.key = from.key;
    this.hash = from.hash;
  }
}

export class JudgeViewResponseDto {
  @ApiProperty({ description: "The SHA-256 of the judge's rubric" })
  readonly rubricHash: string;

  @ApiProperty({ example: 0.2, description: 'The share of runs judged' })
  readonly sample: number;

  @ApiProperty({
    example: 0.6,
    description: 'How often the judge must agree with people',
  })
  readonly minAgreement: number;

  constructor(from: {
    rubricHash: string;
    sample: number;
    minAgreement: number;
  }) {
    this.rubricHash = from.rubricHash;
    this.sample = from.sample;
    this.minAgreement = from.minAgreement;
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

  @ApiProperty({ nullable: true, type: () => ProfileViewResponseDto })
  readonly profile: ProfileViewResponseDto | null;

  @ApiProperty({ nullable: true, type: String, example: 'ghcr.io/acme/api:1' })
  readonly image: string | null;

  @ApiProperty({ type: () => [RepositoryViewResponseDto] })
  readonly repositories: RepositoryViewResponseDto[];

  @ApiProperty({ type: () => [SkillViewResponseDto] })
  readonly skills: SkillViewResponseDto[];

  @ApiProperty({ type: [String], example: ['pull-request'] })
  readonly tools: string[];

  @ApiProperty()
  readonly decisions: boolean;

  @ApiProperty()
  readonly memories: boolean;

  @ApiProperty({ nullable: true, type: () => JudgeViewResponseDto })
  readonly judge: JudgeViewResponseDto | null;

  constructor(from: StationConfigShape) {
    this.prompt = from.prompt;
    this.harness = from.harness;
    this.model = from.model;
    this.effort = from.effort;
    this.profile = from.profile
      ? new ProfileViewResponseDto(from.profile)
      : null;
    this.image = from.image;
    this.repositories = from.repositories.map(
      (each) => new RepositoryViewResponseDto(each),
    );
    this.skills = from.skills.map((each) => new SkillViewResponseDto(each));
    this.tools = [...from.tools];
    this.decisions = from.decisions;
    this.memories = from.memories;
    this.judge = from.judge ? new JudgeViewResponseDto(from.judge) : null;
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
  'judge',
];

export class ConfigChangeResponseDto {
  @ApiProperty({ enum: PARTS, example: 'effort' })
  readonly part: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The repository, skill or tool changed, where the part has several, or the judge setting changed',
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
