import { createHash } from 'node:crypto';
import type { ExpressionErrorDto } from '@integrations/application/dto/expression-check.dto';
import type {
  DescribedOperations,
  IntegrationCompilerPort,
  ParsedIntegration,
} from '@integrations/application/ports/integration-compiler.port';
import {
  INTEGRATIONS,
  integrationAt,
} from '@integrations/application/rendering/integration-problems';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import {
  type ApprovalOverride,
  generatedTools,
} from '@integrations/domain/services/generated-tools';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { ConnectionHolding } from '@integrations/domain/value-objects/connection-holding.vo';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import { cronCalendar } from '@integrations/infrastructure/integrations/cron-calendar';
import type { Additions } from '@integrations/infrastructure/integrations/expression-position';
import {
  orderedTypes,
  refusedHints,
  type Shape,
} from '@integrations/infrastructure/integrations/hints';
import {
  type AuthFile,
  type EventFile,
  type GraphQlFile,
  type IntegrationFile,
  integrationSchema,
  isExpression,
  type McpFile,
  ON_EVENTS,
  type OpenApiFile,
  type RaiseFile,
  type RequestFile,
  secretOf,
  type ToolInputFile,
  written,
} from '@integrations/infrastructure/integrations/integration.schema';
import { Place } from '@integrations/infrastructure/integrations/place';
import { seenAs } from '@integrations/infrastructure/integrations/scopes';
import {
  PIECE,
  type Structured,
  type Templated,
} from '@integrations/infrastructure/integrations/templating';
import { ExpressionError } from '@platform/expressions/expression.errors';
import type {
  Expression,
  ExpressionEnginePort,
} from '@platform/expressions/expression-engine.port';
import type { NamedType, SchemaFields } from '@platform/expressions/scope';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

interface Freshness {
  readonly at: Expression;
  readonly within: number;
}

export type AuthIR =
  | {
      readonly kind: 'hmac';
      readonly algorithm: 'sha256' | 'sha1' | 'sha512';
      readonly secret: string;
      readonly signed: Expression | null;
      readonly encoding: 'hex' | 'base64';
      readonly prefix: string;
      readonly header: string | null;
      readonly freshness: Freshness | null;
    }
  | {
      readonly kind: 'token';
      readonly secret: string;
      readonly header: string | null;
    }
  | { readonly kind: 'secrets'; readonly secrets: readonly string[] }
  | { readonly kind: 'oauth2' }
  | {
      readonly kind: 'asymmetric';
      readonly algorithm: 'ed25519' | 'rsa-sha256';
      readonly key: Templated;
      readonly signed: Expression | null;
      readonly encoding: 'hex' | 'base64';
      readonly header: string | null;
      readonly freshness: Freshness | null;
    }
  | {
      readonly kind: 'jwt';
      readonly jwks: string;
      readonly header: string | null;
      readonly audience: string | null;
      readonly issuer: string | null;
    };

export interface RequestIR {
  readonly method: string;
  readonly url: Templated;
  readonly query: readonly { name: string; value: Templated }[];
  readonly headers: readonly { name: string; value: Templated }[];
  readonly body: Structured | null;
  readonly auth: AuthIR | null;
  readonly expect: {
    readonly success: Expression | null;
    readonly status: readonly number[] | null;
  } | null;
  readonly capture: readonly { name: string; value: Expression }[];
}

export interface RaiseIR {
  readonly happening: string;
  readonly spoken: boolean;
  readonly say: Expression | null;
  readonly opens: {
    readonly onto: string;
    readonly at: string | null;
    readonly title: Expression;
    readonly description: Expression | null;
    readonly assignBy: { readonly email: Expression } | null;
  } | null;
  readonly branch: Expression | null;
  readonly marks: readonly {
    kind: MarkKind;
    value: Expression;
    finds: boolean;
  }[];
  readonly attaches: AttachesIR | null;
}

export interface AttachesIR {
  readonly each: Expression;
  readonly name: Expression;
  readonly type: Expression | null;
  readonly size: Expression | null;
  readonly fetch: RequestIR;
}

interface LookupIR {
  readonly request: RequestIR;
  readonly capture: readonly { name: string; value: Expression }[];
}

export interface EventIR {
  readonly forEach: Expression | null;
  readonly when: Expression;
  readonly lookup: LookupIR | null;
  readonly raise: RaiseIR;
}

interface WebhookIR {
  readonly verify: AuthIR;
  readonly respond: {
    readonly when: Expression;
    readonly body: Expression;
  } | null;
  readonly mine: Expression | null;
  readonly route: Expression | null;
  readonly parse: 'json' | 'form';
  readonly delivery: Expression | null;
  readonly events: readonly EventIR[];
}

interface PollIR {
  readonly request: RequestIR;
  readonly cursor: Expression | null;
  readonly events: readonly EventIR[];
}

export interface OAuth2Endpoints {
  readonly issuer: string | null;
  readonly authorize: string;
  readonly token: string;
  readonly scopes: readonly string[];
  readonly identity: Expression | null;
  readonly registration: string | null;
  readonly resource: string | null;
}

export type OAuth2IR =
  | ({ readonly discoverAt: null } & Omit<OAuth2Endpoints, 'issuer'>)
  | {
      readonly discoverAt: string;
      readonly scopes: readonly string[];
      readonly identity: Expression | null;
      readonly resource: string | null;
    };

interface ConnectionIR {
  readonly holding: ConnectionHolding;
  readonly oauth2: OAuth2IR | null;
  readonly manual: { readonly secrets: readonly string[] } | null;
}

interface OnBindingIR {
  readonly event: string;
  readonly to: readonly { name: string; value: Expression }[];
  readonly routes: ReadonlyMap<string, string>;
  readonly mark: readonly { kind: MarkKind; value: Expression }[];
}

interface ToolInputIR {
  readonly name: string;
  readonly schema: InputSchema;
  readonly description: string | null;
  readonly required: boolean;
  readonly default: Templated | null;
  readonly piped: boolean;
}

interface ToolIR {
  readonly name: string;
  readonly inputs: readonly ToolInputIR[];
  readonly output: Expression | null;
}

interface DescribedIR {
  readonly source: DescribedSource;
  readonly auth: AuthIR | null;
  readonly filter: OperationFilter;
  readonly approvals: ReadonlyMap<string, ApprovalOverride>;
}

export interface ReadableIntegration {
  readonly path: string;
  readonly integration: Integration;
  readonly described: DescribedIR | null;
  readonly webhook: WebhookIR | null;
  readonly poll: PollIR | null;
  readonly connection: ConnectionIR | null;
  readonly actions: ReadonlyMap<string, RequestIR>;
  readonly on: readonly OnBindingIR[];
  readonly tools: ReadonlyMap<string, ToolIR>;
}

export type Compiled =
  | {
      readonly ok: true;
      readonly readable: ReadableIntegration;
      readonly definition: IntegrationFile;
      readonly passedOver: readonly string[];
      readonly warnings: readonly ConfigurationProblem[];
      readonly places: ReadonlyMap<string, Place>;
    }
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const becauseOf = (error: unknown): string =>
  error instanceof InvalidIntegrationError ||
  error instanceof InvalidIntegrationPartError ||
  error instanceof InvalidIdentifierError
    ? error.because
    : reasoned(error);

const READS_A_SECRET = /(^|[^A-Za-z0-9_.])secret\s*(\.|\[)/;

const doubted = (error: ExpressionErrorDto): string =>
  error.suggestion
    ? `does not check: ${error.message}. Did you mean ${error.suggestion}?`
    : `does not check: ${error.message}`;

class Compiler {
  readonly problems: ConfigurationProblem[] = [];
  readonly warnings: ConfigurationProblem[] = [];
  readonly secrets = new Set<string>();
  readonly places = new Map<string, Place>();
  private readonly warned = new Set<string>();

  constructor(
    private readonly expressions: ExpressionEnginePort,
    private readonly path: string,
    private readonly hinting: boolean,
  ) {}

  part<T>(at: FieldPath, build: () => T): T | null {
    try {
      return build();
    } catch (error) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at,
          reason: becauseOf(error),
        }),
      );

      return null;
    }
  }

  declared(
    event: EventFile,
    where: FieldPath,
    source: SourceKey,
  ): DeclaredHappening | null {
    const happening = this.part(where.to('raise', 'happening'), () =>
      source.claim(HappeningName.of(event.raise.happening)),
    );
    const opens = event.raise.opens;
    const opening = opens
      ? this.part(where.to('raise', 'opens'), () =>
          Opening.of({ onto: opens.onto, at: opens.at ?? null }),
        )
      : null;

    if (!happening || (opens && !opening)) {
      return null;
    }

    return this.part(where.to('raise'), () =>
      DeclaredHappening.of({
        happening,
        label: event.raise.label ?? event.raise.happening,
        told: event.raise.told ?? event.raise.happening,
        spoken: event.raise.spoken,
        finds: event.raise.marks
          .filter((mark) => mark.find)
          .map((mark) => MarkKind.of(mark.kind)),
        findsByBranch: event.raise.branch !== undefined,
        opens: opening,
      }),
    );
  }

  expression(held: string, place: Place): Expression | null {
    if (READS_A_SECRET.test(held)) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at: place.field,
          reason:
            'reads a secret’s value. No expression may read a secret. Please name the secret in auth.secrets, and Spotlight wears it toward the hosts it is bound to',
        }),
      );

      return null;
    }

    const source = written(held);

    try {
      const compiled = this.expressions.compile(source, {
        at: place.field.rendered,
      });
      const verdict = place.checked(this.expressions, source);

      this.places.set(place.field.rendered, place);

      for (const error of verdict.errors) {
        this.warn(place.field, doubted(error));
      }

      for (const warning of verdict.warnings) {
        this.warn(warning.field, warning.message);
      }

      return compiled;
    } catch (error) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at: place.field,
          reason:
            error instanceof ExpressionError ? error.message : reasoned(error),
        }),
      );

      return null;
    }
  }

  warn(at: FieldPath, reason: string): void {
    const key = `${at.rendered} ${reason}`;

    if (!this.warned.has(key)) {
      this.warned.add(key);
      this.warnings.push(
        ConfigurationProblem.of({
          path: this.path,
          at,
          reason,
          severity: 'warning',
        }),
      );
    }
  }

  templated(held: string, place: Place): Templated {
    if (isExpression(held)) {
      const whole = this.expression(held, place);

      return { parts: whole ? [whole] : [] };
    }

    const parts: (string | Expression)[] = [];
    let from = 0;

    for (const found of held.matchAll(PIECE)) {
      const start = found.index ?? 0;

      if (start > from) {
        parts.push(held.slice(from, start));
      }

      const piece = this.expression(found[0], place);
      if (piece) {
        parts.push(piece);
      }

      from = start + found[0].length;
    }

    if (from < held.length || parts.length === 0) {
      parts.push(held.slice(from));
    }

    return { parts };
  }

  structured(held: unknown, place: Place): Structured {
    if (typeof held === 'string') {
      return { kind: 'templated', templated: this.templated(held, place) };
    }

    if (Array.isArray(held)) {
      return {
        kind: 'list',
        items: held.map((each, index) =>
          this.structured(each, place.inside(index)),
        ),
      };
    }

    if (held !== null && typeof held === 'object') {
      return {
        kind: 'map',
        entries: Object.entries(held).map(([key, each]) => ({
          key,
          value: this.structured(each, place.inside(key)),
        })),
      };
    }

    return {
      kind: 'value',
      value:
        typeof held === 'number' || typeof held === 'boolean' ? held : null,
    };
  }

  freshness(
    freshness: { at: string; within: string } | undefined,
    place: Place,
  ): Freshness | null {
    if (!freshness) {
      return null;
    }

    return {
      at: this.expression(freshness.at, place.to('at')) as Expression,
      within: Number.parseInt(freshness.within, 10),
    };
  }

  auth(auth: AuthFile, place: Place): AuthIR {
    if (auth.hmac) {
      this.secrets.add(secretOf(auth.hmac.secret));

      return {
        kind: 'hmac',
        algorithm: auth.hmac.algorithm,
        secret: secretOf(auth.hmac.secret),
        signed: auth.hmac.signed
          ? this.expression(auth.hmac.signed, place.to('hmac.signed'))
          : null,
        encoding: auth.hmac.encoding,
        prefix: auth.hmac.prefix,
        header: auth.hmac.header ?? null,
        freshness: this.freshness(
          auth.hmac.freshness,
          place.to('hmac.freshness'),
        ),
      };
    }

    if (auth.token) {
      this.secrets.add(secretOf(auth.token.secret));

      return {
        kind: 'token',
        secret: secretOf(auth.token.secret),
        header: auth.token.header ?? null,
      };
    }

    if (auth.secrets) {
      const secrets = [...new Set(auth.secrets.map(secretOf))];

      for (const name of secrets) {
        this.secrets.add(name);
      }

      return { kind: 'secrets', secrets };
    }

    if (auth.asymmetric) {
      return {
        kind: 'asymmetric',
        algorithm: auth.asymmetric.algorithm,
        key: this.templated(auth.asymmetric.key, place.to('asymmetric.key')),
        signed: auth.asymmetric.signed
          ? this.expression(
              auth.asymmetric.signed,
              place.to('asymmetric.signed'),
            )
          : null,
        encoding: auth.asymmetric.encoding,
        header: auth.asymmetric.header ?? null,
        freshness: this.freshness(
          auth.asymmetric.freshness,
          place.to('asymmetric.freshness'),
        ),
      };
    }

    if (auth.jwt) {
      return {
        kind: 'jwt',
        jwks: auth.jwt.jwks,
        header: auth.jwt.header ?? null,
        audience: auth.jwt.audience ?? null,
        issuer: auth.jwt.issuer ?? null,
      };
    }

    return { kind: 'oauth2' };
  }

  request(request: RequestFile, at: Place): RequestIR {
    const place = at.adding(
      this.hinting && request.response
        ? { response: request.response as SchemaFields }
        : {},
    );

    return {
      method: request.method,
      url: this.templated(request.url, place.to('url')),
      query: Object.entries(request.query).map(([name, value]) => ({
        name,
        value: this.templated(value, place.to('query').each(name)),
      })),
      headers: Object.entries(request.headers).map(([name, value]) => ({
        name,
        value: this.templated(value, place.to('headers').each(name)),
      })),
      body:
        request.body !== undefined
          ? this.structured(request.body, place.to('body'))
          : null,
      auth: request.auth ? this.auth(request.auth, place.to('auth')) : null,
      expect: request.expect
        ? {
            success: request.expect.success
              ? this.expression(
                  request.expect.success,
                  place.to('expect.success'),
                )
              : null,
            status: request.expect.status ?? null,
          }
        : null,
      capture: Object.entries(request.capture ?? {}).map(([name, value]) => ({
        name,
        value: this.expression(
          value,
          place.to('capture').each(name),
        ) as Expression,
      })),
    };
  }

  event(event: EventFile, place: Place): EventIR {
    const each = place.adding(event.forEach ? { iterates: true } : {});
    const captured = Object.keys(event.lookup?.capture ?? {}).map((name) => ({
      name,
      field: place.field.to('lookup', 'capture', name),
    }));

    return {
      forEach: event.forEach
        ? this.expression(event.forEach, place.to('forEach'))
        : null,
      when: this.expression(event.when, each.to('when')) as Expression,
      lookup: event.lookup
        ? {
            request: this.request(
              event.lookup.request,
              each.to('lookup.request'),
            ),
            capture: Object.entries(event.lookup.capture).map(
              ([name, value]) => ({
                name,
                value: this.expression(
                  value,
                  each.to('lookup.capture').each(name),
                ) as Expression,
              }),
            ),
          }
        : null,
      raise: this.raise(event.raise, each.to('raise').adding({ captured })),
    };
  }

  raise(raise: RaiseFile, place: Place): RaiseIR {
    return {
      happening: raise.happening,
      spoken: raise.spoken,
      say: raise.say ? this.expression(raise.say, place.to('say')) : null,
      opens: raise.opens
        ? {
            onto: raise.opens.onto,
            at: raise.opens.at ?? null,
            title: this.expression(
              raise.opens.title,
              place.to('opens.title'),
            ) as Expression,
            description: raise.opens.description
              ? this.expression(
                  raise.opens.description,
                  place.to('opens.description'),
                )
              : null,
            assignBy: raise.opens.assignBy
              ? {
                  email: this.expression(
                    raise.opens.assignBy.email,
                    place.to('opens.assignBy.email'),
                  ) as Expression,
                }
              : null,
          }
        : null,
      branch: raise.branch
        ? this.expression(raise.branch, place.to('branch'))
        : null,
      marks: raise.marks.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: this.expression(
          mark.value,
          place.to('marks').each(index).to('value'),
        ) as Expression,
        finds: mark.find,
      })),
      attaches: raise.attaches
        ? {
            each: this.expression(
              raise.attaches.each,
              place.to('attaches.each'),
            ) as Expression,
            name: this.expression(
              raise.attaches.name,
              place.to('attaches.name'),
            ) as Expression,
            type: raise.attaches.type
              ? this.expression(raise.attaches.type, place.to('attaches.type'))
              : null,
            size: raise.attaches.size
              ? this.expression(raise.attaches.size, place.to('attaches.size'))
              : null,
            fetch: this.request(
              raise.attaches.fetch,
              place.to('attaches.fetch'),
            ),
          }
        : null,
    };
  }
}

type SourceFile =
  | { readonly kind: 'openapi'; readonly file: OpenApiFile }
  | { readonly kind: 'graphql'; readonly file: GraphQlFile }
  | { readonly kind: 'mcp'; readonly file: McpFile };

const sourceFileOf = (file: IntegrationFile): SourceFile | null =>
  file.openapi
    ? { kind: 'openapi', file: file.openapi }
    : file.graphql
      ? { kind: 'graphql', file: file.graphql }
      : file.mcp
        ? { kind: 'mcp', file: file.mcp }
        : null;

const documentOf = (written: SourceFile): string | null =>
  written.kind === 'mcp' || written.file.document === undefined
    ? null
    : typeof written.file.document === 'string'
      ? written.file.document
      : JSON.stringify(written.file.document);

const revisionOf = (written: SourceFile): string | null =>
  written.kind === 'mcp' ? null : (written.file.revision ?? null);

const fingerprintOf = (written: SourceFile): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        kind: written.kind,
        url: written.file.url ?? null,
        document: documentOf(written),
        baseUrl:
          written.kind === 'openapi' ? (written.file.baseUrl ?? null) : null,
        revision: revisionOf(written),
        depth: written.kind === 'graphql' ? (written.file.depth ?? null) : null,
        connected: written.file.auth?.oauth2 !== undefined,
      }),
    )
    .digest('hex');

const describedSourceOf = (
  written: SourceFile,
  auth: AuthIR | null,
): DescribedSource => {
  const document = documentOf(written);

  return DescribedSource.of({
    kind: written.kind,
    url: written.file.url ?? null,
    document,
    baseUrl: written.kind === 'openapi' ? (written.file.baseUrl ?? null) : null,
    depth: written.kind === 'graphql' ? (written.file.depth ?? null) : null,
    wears:
      auth?.kind === 'secrets'
        ? auth.secrets.map((each) => SecretName.of(each))
        : [],
    connected: auth?.kind === 'oauth2',
    fingerprint: fingerprintOf(written),
  });
};

const discoveredAt = (mcp: string | null): string => {
  if (mcp === null) {
    throw new InvalidIntegrationPartError(
      'connection',
      'discovers how to connect from its MCP server, but mcp.url names no MCP server',
    );
  }

  return mcp;
};

const oauth2Of = (
  written: NonNullable<NonNullable<IntegrationFile['connection']>['oauth2']>,
  mcp: string | null,
  identity: Expression | null,
): OAuth2IR =>
  written.discover
    ? {
        discoverAt: discoveredAt(mcp),
        scopes: written.scopes,
        identity,
        resource: written.resource ?? null,
      }
    : {
        discoverAt: null,
        authorize: written.authorize,
        token: written.token,
        scopes: written.scopes,
        registration: written.registration ?? null,
        resource: written.resource ?? null,
        identity,
      };

const inputSchemaOf = (input: ToolInputFile): InputSchema =>
  input.schema
    ? InputSchema.of(
        input.description && !('description' in input.schema)
          ? { ...input.schema, description: input.description }
          : input.schema,
      )
    : InputSchema.ofType(input.type ?? 'string', input.description ?? null);

const addressOf = (held: unknown): string => {
  const source =
    typeof held === 'object' && held !== null && 'integration' in held
      ? held.integration
      : null;

  try {
    return typeof source === 'string'
      ? integrationAt(SourceKey.of(source).value)
      : INTEGRATIONS;
  } catch {
    return INTEGRATIONS;
  }
};

export const compileIntegration = (
  held: unknown,
  expressions: ExpressionEnginePort,
  described: DescribedOperations | null = null,
): Compiled => {
  const read = integrationSchema.safeParse(held);

  if (!read.success) {
    const path = addressOf(held);

    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: FieldPath.of(issue.path),
          reason: issue.message,
        }),
      ),
    };
  }

  const file = read.data;
  const path = addressOf(file);
  const hintWarnings = hintProblemsOf(path, file);
  const hinting = hintWarnings.length === 0;
  const typeOrder = orderedTypes(file.types as Record<string, Shape>).order;
  const compiler = new Compiler(expressions, path, hinting);
  compiler.warnings.push(...hintWarnings);

  const hinted = (additions: Additions): Additions =>
    hinting ? additions : {};
  const root = Place.root().adding(
    hinted({
      types: typeOrder.map(
        (name): NamedType => [name, file.types[name] as SchemaFields],
      ),
    }),
  );
  const hooked = root
    .to('webhook')
    .adding(
      hinted(
        file.webhook?.shape ? { body: file.webhook.shape as SchemaFields } : {},
      ),
    );
  const polled = root
    .to('poll')
    .adding(
      hinted(file.poll?.shape ? { body: file.poll.shape as SchemaFields } : {}),
    );
  const source = SourceKey.of(file.integration);

  const webhook: WebhookIR | null = file.webhook
    ? {
        verify: compiler.auth(file.webhook.verify, hooked.to('verify')),
        respond: file.webhook.respond
          ? {
              when: compiler.expression(
                file.webhook.respond.when,
                hooked.to('respond.when'),
              ) as Expression,
              body: compiler.expression(
                file.webhook.respond.body,
                hooked.to('respond.body'),
              ) as Expression,
            }
          : null,
        mine: file.webhook.mine
          ? compiler.expression(file.webhook.mine, hooked.to('mine'))
          : null,
        route: file.webhook.route
          ? compiler.expression(file.webhook.route.by, hooked.to('route.by'))
          : null,
        parse: file.webhook.parse,
        delivery: file.webhook.delivery
          ? compiler.expression(file.webhook.delivery, hooked.to('delivery'))
          : null,
        events: file.webhook.events.map((event, at) =>
          compiler.event(event, hooked.to('events').each(at)),
        ),
      }
    : null;

  const poll: PollIR | null = file.poll
    ? {
        request: compiler.request(file.poll.request, polled.to('request')),
        cursor: file.poll.cursor
          ? compiler.expression(file.poll.cursor, polled.to('cursor'))
          : null,
        events: file.poll.events.map((event, at) =>
          compiler.event(event, polled.to('events').each(at)),
        ),
      }
    : null;

  const inputsOf = new Map<string, Record<string, string>>();
  for (const tool of Object.values(file.tools)) {
    const held = inputsOf.get(tool.does) ?? {};
    for (const [name, input] of Object.entries(tool.inputs)) {
      const type = seenAs(inputSchemaOf(input));
      held[name] =
        held[name] === undefined || held[name] === type ? type : 'dyn';
    }
    inputsOf.set(tool.does, held);
  }

  const actions = new Map<string, RequestIR>();
  for (const [name, action] of Object.entries(file.actions)) {
    const inputs = inputsOf.get(name);

    actions.set(
      name,
      compiler.request(
        action.request,
        root
          .to('actions')
          .each(name)
          .to('request')
          .adding(inputs ? { inputs } : {}),
      ),
    );
  }

  const defined = compiler.part(FieldPath.of(['actions']), () =>
    DefinedActions.of(Object.keys(file.actions)),
  );

  const tools = new Map<string, ToolIR>();
  for (const [name, tool] of Object.entries(file.tools)) {
    const at = `tools.${name}`;
    const offered = root.to('tools').each(name);

    compiler.part(FieldPath.of(['tools', name, 'does']), () =>
      defined?.named(tool.does, at),
    );

    tools.set(name, {
      name,
      inputs: Object.entries(tool.inputs).map(([input, declared]) => ({
        name: input,
        schema: inputSchemaOf(declared),
        description: declared.description ?? null,
        required: declared.required,
        piped: declared.piped,
        default:
          declared.default !== undefined
            ? compiler.templated(
                declared.default,
                offered.to('inputs').each(input).to('default'),
              )
            : null,
      })),
      output: tool.output
        ? compiler.expression(
            tool.output,
            offered
              .to('output')
              .adding({ inputs: inputsOf.get(tool.does) ?? {} }),
          )
        : null,
    });
  }

  const oauth2File = file.connection?.oauth2;
  const connection: ConnectionIR | null = file.connection
    ? {
        holding: ConnectionHolding.of(file.connection.holder),
        oauth2: oauth2File
          ? compiler.part(FieldPath.of(['connection', 'oauth2']), () =>
              oauth2Of(
                oauth2File,
                file.mcp?.url ?? null,
                oauth2File.identity
                  ? compiler.expression(
                      oauth2File.identity,
                      root.to('connection.oauth2.identity'),
                    )
                  : null,
              ),
            )
          : null,
        manual: file.connection.manual
          ? {
              secrets: file.connection.manual.secrets.map((each) => {
                const name = secretOf(each);
                compiler.secrets.add(name);
                return name;
              }),
            }
          : null,
      }
    : null;

  const written = sourceFileOf(file);
  const filter = written
    ? compiler.part(FieldPath.of([written.kind, 'tools']), () =>
        OperationFilter.of(written.file.tools),
      )
    : null;
  const approvals = new Map<string, ApprovalOverride>();
  if (written) {
    for (const [name, approval] of Object.entries(
      written.file.tools.approval,
    )) {
      const at = FieldPath.of([written.kind, 'tools', 'approval', name]);
      const override = compiler.part(at, () =>
        approval === false ? false : ApprovalNeeded.of(approval, at.rendered),
      );
      if (override !== null) {
        approvals.set(name, override);
      }
    }
  }
  const describedIR: DescribedIR | null =
    written && filter
      ? (() => {
          const auth = written.file.auth
            ? compiler.auth(written.file.auth, root.to(written.kind).to('auth'))
            : null;
          const source = compiler.part(FieldPath.of([written.kind]), () =>
            describedSourceOf(written, auth),
          );

          return source ? { source, auth, filter, approvals } : null;
        })()
      : null;

  const schedule = file.schedule
    ? (() => {
        const written = file.schedule;
        const cron = compiler.part(FieldPath.of(['schedule', 'cron']), () =>
          CronExpression.of(written.cron, cronCalendar),
        );
        const does = compiler.part(FieldPath.of(['schedule', 'do']), () =>
          defined?.named(written.do, 'schedule'),
        );

        return cron && does ? Schedule.of({ cron, does }) : null;
      })()
    : null;

  const bindings: Binding[] = [];
  const on: OnBindingIR[] = Object.entries(file.on).map(([event, binding]) => {
    const bound = compiler.part(FieldPath.of(['on', event]), () =>
      Binding.of({ event, does: binding.do, known: ON_EVENTS }),
    );
    const does = compiler.part(FieldPath.of(['on', event, 'do']), () =>
      defined?.named(binding.do, `binding on ${event}`),
    );

    if (bound && does) {
      bindings.push(bound);
    }

    return {
      event,
      to: Object.entries(binding.to).map(([name, value]) => ({
        name,
        value: compiler.expression(
          value,
          root.to('on').each(event).to('to').each(name),
        ) as Expression,
      })),
      routes: new Map(Object.entries(binding.routes)),
      mark: binding.mark.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: compiler.expression(
          mark.value,
          root.to('on').each(event).to('mark').each(index).to('value'),
        ) as Expression,
      })),
    };
  });

  const webhookDeclares = (file.webhook?.events ?? []).map((event, at) =>
    compiler.declared(event, FieldPath.of(['webhook', 'events', at]), source),
  );
  const pollDeclares = (file.poll?.events ?? []).map((event, at) =>
    compiler.declared(event, FieldPath.of(['poll', 'events', at]), source),
  );
  const approvalOf = (
    written: { because: string } | undefined,
    name: string,
  ): ApprovalNeeded | null =>
    written ? ApprovalNeeded.of(written, `tools.${name}.approval`) : null;

  const offers = [...tools.values()].map((tool) =>
    compiler.part(FieldPath.of(['tools', tool.name]), () =>
      OfferedTool.of({
        source,
        name: tool.name,
        description: file.tools[tool.name]?.description ?? '',
        backing: ToolBacking.action(file.tools[tool.name]?.does ?? ''),
        approval: approvalOf(file.tools[tool.name]?.approval, tool.name),
        inputs: tool.inputs.map((input) => ({
          name: input.name,
          schema: input.schema,
          description: input.description,
          required: input.required,
          defaulted: input.default !== null,
          piped: input.piped,
        })),
      }),
    ),
  );

  const generation =
    described && describedIR && written
      ? compiler.part(FieldPath.of([written.kind, 'tools']), () =>
          generatedTools({
            source,
            integration: file.name?.trim() || source.value,
            described: describedIR.source,
            hash: described.hash,
            operations: described.operations,
            filter: describedIR.filter,
            approvals: describedIR.approvals,
            handWritten: Object.keys(file.tools),
          }),
        )
      : null;

  if (written && described) {
    const named = new Set(described.operations.map((each) => each.name));

    for (const name of approvals.keys()) {
      if (!named.has(name)) {
        compiler.warn(
          FieldPath.of([written.kind, 'tools', 'approval', name]),
          `names ${name}, but no operation of its ${describedIR?.source.described ?? 'description'} has that name`,
        );
      }
    }
  }

  if (compiler.problems.length > 0 || !defined) {
    return {
      ok: false,
      problems: [...compiler.problems, ...compiler.warnings],
    };
  }

  try {
    const integration = Integration.of({
      source,
      name: file.name,
      webhook: file.webhook
        ? Webhook.of({ declares: webhookDeclares.filter(isPresent) })
        : null,
      poll: file.poll
        ? Poll.of({
            every: Number.parseInt(file.poll.every, 10),
            declares: pollDeclares.filter(isPresent),
          })
        : null,
      schedule,
      actions: defined,
      bindings,
      connects: connection?.oauth2 !== null && connection?.oauth2 !== undefined,
      holding: connection?.holding,
      credentials: [...compiler.secrets].map((name) => SecretName.of(name)),
      offers: [...offers.filter(isPresent), ...(generation?.tools ?? [])],
    });

    return {
      ok: true,
      readable: {
        path,
        integration,
        described: describedIR,
        webhook,
        poll,
        connection,
        actions,
        on,
        tools,
      },
      definition: file,
      passedOver: generation?.passedOver ?? [],
      warnings: compiler.warnings,
      places: compiler.places,
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: FieldPath.root(),
          reason: reasoned(error),
        }),
        ...compiler.warnings,
      ],
    };
  }
};

const isPresent = <T>(each: T | null): each is T => each !== null;

const hintProblemsOf = (
  path: string,
  file: IntegrationFile,
): ConfigurationProblem[] => {
  const known = new Set(Object.keys(file.types));
  const shapes: [Shape, FieldPath][] = [
    ...Object.entries(file.types).map(([name, shape]): [Shape, FieldPath] => [
      shape as Shape,
      FieldPath.of(['types', name]),
    ]),
    ...(file.webhook?.shape
      ? [[file.webhook.shape as Shape, FieldPath.of(['webhook', 'shape'])]]
      : []),
    ...(file.poll?.shape
      ? [[file.poll.shape as Shape, FieldPath.of(['poll', 'shape'])]]
      : []),
    ...(file.poll?.request.response
      ? [
          [
            file.poll.request.response as Shape,
            FieldPath.of(['poll', 'request', 'response']),
          ],
        ]
      : []),
    ...Object.entries(file.actions).flatMap(([name, action]) =>
      action.request.response
        ? [
            [
              action.request.response as Shape,
              FieldPath.of(['actions', name, 'request', 'response']),
            ],
          ]
        : [],
    ),
  ] as [Shape, FieldPath][];

  const refused = shapes.flatMap(([shape, at]) =>
    refusedHints(shape, at, known),
  );
  const { cycle } = orderedTypes(file.types as Record<string, Shape>);

  return [
    ...refused,
    ...(cycle
      ? [
          {
            at: FieldPath.of(['types', cycle]),
            reason:
              'refers to itself, directly or through other types. A check cannot follow such a type',
          },
        ]
      : []),
  ].map((each) =>
    ConfigurationProblem.of({
      path,
      at: each.at,
      reason: each.reason,
      severity: 'warning',
    }),
  );
};

export class IntegrationCompiler implements IntegrationCompilerPort {
  constructor(private readonly expressions: ExpressionEnginePort) {}

  compile(
    held: unknown,
    described: DescribedOperations | null = null,
  ): ParsedIntegration {
    const compiled = compileIntegration(held, this.expressions, described);

    return compiled.ok
      ? {
          ok: true,
          integration: compiled.readable.integration,
          document: DefinitionDocument.of(compiled.definition),
          source: compiled.readable.described?.source ?? null,
          passedOver: compiled.passedOver,
          warnings: compiled.warnings,
        }
      : compiled;
  }
}
