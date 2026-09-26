import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import { HOOK_EVENTS } from '@integrations/domain/value-objects/hook-event.vo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

type Held = Readonly<Record<string, unknown>>;

const listOf = (held: unknown): string[] =>
  Array.isArray(held) ? held.map(String) : [];

export class HookMatchDto {
  @ApiProperty({
    type: [String],
    example: ['grafana.search'],
    description:
      'Tools the hook fires for, as integration.tool; only on tool.using and tool.used',
  })
  readonly tools: string[];

  @ApiProperty({
    type: [String],
    example: ['delivery'],
    description: 'Line keys whose tasks the hook fires for',
  })
  readonly lines: string[];

  @ApiProperty({
    type: [String],
    example: ['implementation'],
    description: 'Station keys whose tasks the hook fires for',
  })
  readonly stations: string[];

  @ApiProperty({
    type: [String],
    example: ['acme/api'],
    description: 'Repositories, as owner/name, the hook fires for',
  })
  readonly repositories: string[];

  @ApiProperty({
    type: [String],
    example: ['db/migrations/**'],
    description:
      'Changed paths the hook fires for, as globs; only on pull-request.opening and pull-request.merged',
  })
  readonly paths: string[];

  constructor(held: Held) {
    this.tools = listOf(held.tools);
    this.lines = listOf(held.lines);
    this.stations = listOf(held.stations);
    this.repositories = listOf(held.repositories);
    this.paths = listOf(held.paths);
  }
}

export class HookRequestDto {
  @ApiProperty({
    example: 'https://dba.acme.dev/review',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
    description: 'Where the request goes; may hold ${{ }} expressions',
  })
  readonly url: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'x-team': 'core' },
    description: 'Headers to send besides the ones Spotlight signs with',
  })
  readonly headers: Record<string, string>;

  @ApiPropertyOptional({
    description:
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      'The JSON body, any JSON value; strings may hold ${{ }} expressions. Left out, Spotlight sends the event, task and run',
    oneOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
    ],
  })
  readonly body?: unknown;

  @ApiProperty({
    enum: ['spotlight', 'network'],
    example: 'spotlight',
    description:
      'spotlight sends it from Spotlight to an allowed host; network has a host of the workspace send it from inside its network, through egress',
  })
  readonly from: 'spotlight' | 'network';

  constructor(held: Held) {
    this.url = String(held.url ?? '');
    this.headers = { ...((held.headers ?? {}) as Record<string, string>) };
    this.body = held.body;
    this.from = held.from === 'network' ? 'network' : 'spotlight';
  }
}

export class HookStepDto {
  @ApiProperty({
    example: 'notify',
    description: 'Names the step; later steps read its output as step.<name>',
  })
  readonly name: string;

  @ApiPropertyOptional({
    example: 'slack.post-message',
    description: 'The tool the step calls, as integration.tool',
  })
  readonly call?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {},
    example: {
      channel: 'C024BE91L',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
      text: 'Agent searched ${{ event.inputs.query }}',
    },
    description: 'The inputs the step gives its tool',
  })
  readonly with?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: HookRequestDto,
    description: 'The request the step makes',
  })
  readonly request?: HookRequestDto;

  constructor(held: Held) {
    this.name = String(held.name ?? '');

    if (typeof held.call === 'string') {
      this.call = held.call;
      this.with = { ...((held.with ?? {}) as Record<string, unknown>) };
    }

    if (held.request && typeof held.request === 'object') {
      this.request = new HookRequestDto(held.request as Held);
    }
  }
}

export class HookOidcDto {
  @ApiProperty({
    example: 'https://dba.acme.dev',
    description: 'The audience the token is for, as the endpoint checks it',
  })
  readonly audience: string;

  constructor(held: Held) {
    this.audience = String(held.audience ?? '');
  }
}

export class HookSigningDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'The version of the HMAC secret; changed to rotate secret, which is write-only and never answered',
  })
  readonly secretVersion?: number;

  @ApiPropertyOptional({
    type: HookOidcDto,
    description: 'Sign each request with a short-lived OIDC token instead',
  })
  readonly oidc?: HookOidcDto;

  constructor(held: Held) {
    if (typeof held.secretVersion === 'number') {
      this.secretVersion = held.secretVersion;
    }

    if (held.oidc && typeof held.oidc === 'object') {
      this.oidc = new HookOidcDto(held.oidc as Held);
    }
  }
}

export class HookResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'migrations-need-a-dba',
    description:
      'Names the hook within its team; fixed for its life, so changing it means replacing the hook',
  })
  readonly key: string;

  @ApiProperty({
    enum: HOOK_EVENTS,
    example: 'pull-request.opening',
    description: 'The event the hook fires on',
  })
  readonly on: string;

  @ApiProperty({ type: HookMatchDto })
  readonly match: HookMatchDto;

  @ApiPropertyOptional({
    example: 'event.changed.size() > 0',
    description: 'A CEL condition the event must meet, besides match',
  })
  readonly when?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { migrations: 'db/migrations/' },
    description: 'Values the expressions read as vars.<name>',
  })
  readonly vars: Record<string, string>;

  @ApiProperty({ type: [HookStepDto] })
  readonly steps: HookStepDto[];

  @ApiPropertyOptional({ type: HookSigningDto, nullable: true })
  readonly signing: HookSigningDto | null;

  @ApiProperty({
    enum: ['continue', 'block'],
    example: 'continue',
    description:
      'What a failed step does to the event: continue lets it go on; block stops it, before an event only',
  })
  readonly failure: string;

  @ApiProperty({
    example: 10,
    description: 'How long each request may take, and a before-hook as a whole',
  })
  readonly timeoutSeconds: number;

  constructor(hook: HookResourceDto) {
    super(hook);
    const held = hook.definition;

    this.teamId = hook.teamId;
    this.key = String(held.key ?? '');
    this.on = String(held.on ?? '');
    this.match = new HookMatchDto((held.match ?? {}) as Held);

    if (typeof held.when === 'string') {
      this.when = held.when;
    }

    this.vars = { ...((held.vars ?? {}) as Record<string, string>) };
    this.steps = ((held.steps ?? []) as Held[]).map(
      (step) => new HookStepDto(step),
    );
    this.signing =
      held.signing && typeof held.signing === 'object'
        ? new HookSigningDto(held.signing as Held)
        : null;
    this.failure = String(held.failure ?? 'continue');
    this.timeoutSeconds = Number(held.timeoutSeconds ?? 10);
  }
}
