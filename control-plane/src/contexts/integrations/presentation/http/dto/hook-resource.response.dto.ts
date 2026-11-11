import type {
  HookRequestView,
  HookResourceDto,
  HookStepView,
} from '@integrations/application/dto/hook-resource.dto';
import type {
  WrittenHookMatch,
  WrittenHookSigning,
} from '@integrations/application/ports/hook-resources.port';
import { HOOK_ON_FAILURES } from '@integrations/domain/value-objects/hook.vo';
import { HOOK_EVENTS } from '@integrations/domain/value-objects/hook-event.vo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

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

  constructor(match: WrittenHookMatch) {
    this.tools = [...match.tools];
    this.lines = [...match.lines];
    this.stations = [...match.stations];
    this.repositories = [...match.repositories];
    this.paths = [...match.paths];
  }
}

export class HookRequestDto {
  @ApiProperty({
    example: 'https://dba.acme.dev/review',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: how a hook expression is written
    description: 'Where the request goes; may contain ${{ }} expressions',
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
      'The JSON body, any JSON value; strings may contain ${{ }} expressions. Left out, Spotlight sends the event, task and run',
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

  constructor(request: HookRequestView) {
    this.url = request.url;
    this.headers = { ...request.headers };
    this.body = request.body;
    this.from = request.from;
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
    description: 'The inputs the step sends to its tool',
  })
  readonly with?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: HookRequestDto,
    description: 'The request the step makes',
  })
  readonly request?: HookRequestDto;

  constructor(step: HookStepView) {
    this.name = step.name;

    if ('call' in step) {
      this.call = step.call;
      this.with = { ...step.with };
    } else {
      this.request = new HookRequestDto(step.request);
    }
  }
}

export class HookOidcDto {
  @ApiProperty({
    example: 'https://dba.acme.dev',
    description: 'The audience the token is for, as the endpoint checks it',
  })
  readonly audience: string;

  constructor(audience: string) {
    this.audience = audience;
  }
}

export class HookSigningDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'The version of the HMAC secret; changed to rotate secret, which is write-only and never returned',
  })
  readonly secretVersion?: number;

  @ApiPropertyOptional({
    type: HookOidcDto,
    description: 'Sign each request with a short-lived OIDC token instead',
  })
  readonly oidc?: HookOidcDto;

  constructor(signing: WrittenHookSigning) {
    if ('oidc' in signing) {
      this.oidc = new HookOidcDto(signing.oidc.audience);
    } else {
      this.secretVersion = signing.secretVersion;
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
      'Names the hook within its team. Immutable: changing it means replacing the hook',
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
    enum: [...HOOK_ON_FAILURES],
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

    this.teamId = hook.teamId;
    this.key = hook.key;
    this.on = hook.on;
    this.match = new HookMatchDto(hook.match);

    if (hook.when !== null) {
      this.when = hook.when;
    }

    this.vars = { ...hook.vars };
    this.steps = hook.steps.map((step) => new HookStepDto(step));
    this.signing = hook.signing ? new HookSigningDto(hook.signing) : null;
    this.failure = hook.failure;
    this.timeoutSeconds = hook.timeoutSeconds;
  }
}
