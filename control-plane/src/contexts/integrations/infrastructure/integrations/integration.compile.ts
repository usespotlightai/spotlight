import type {
  CompiledIntegration,
  IntegrationCompilerPort,
} from '@integrations/application/ports/integration-compiler.port';
import { Integration } from '@integrations/domain/entities/integration.entity';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import {
  OfferedTool,
  type ToolInputType,
} from '@integrations/domain/value-objects/offered-tool.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import { cronCalendar } from '@integrations/infrastructure/integrations/cron-calendar';
import {
  compile as compileExpression,
  type Expression,
  ExpressionError,
  type NamedType,
  type SchemaFields,
  type Scope,
} from '@integrations/infrastructure/integrations/expression';
import {
  orderedTypes,
  refusedHints,
  type Shape,
} from '@integrations/infrastructure/integrations/hints';
import {
  type AuthFile,
  type EventFile,
  type IntegrationFile,
  integrationSchema,
  isExpression,
  ON_EVENTS,
  type RaiseFile,
  type RequestFile,
  secretOf,
  written,
} from '@integrations/infrastructure/integrations/integration.schema';
import {
  ACTING,
  ADDRESSING,
  answered,
  attaching,
  capturing,
  DEFAULTING,
  DELIVERED,
  iterating,
  LINKED,
  MARKING,
  POLLED,
  POLLING,
  requesting,
  withInputs,
} from '@integrations/infrastructure/integrations/scopes';
import {
  PIECE,
  type Structured,
  type Templated,
} from '@integrations/infrastructure/integrations/templating';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SECRET_NAME_SHAPE } from '@shared-kernel/domain/value-objects/identifier-shapes';
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
      readonly scheme: 'bearer' | 'raw';
    }
  | {
      readonly kind: 'basic';
      readonly username: Templated;
      readonly password: Templated;
    }
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

export interface ConnectionIR {
  readonly oauth2: {
    readonly authorize: string;
    readonly token: string;
    readonly scopes: readonly string[];
    readonly identity: Expression | null;
  } | null;
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
  readonly type: ToolInputType;
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

export interface ReadableIntegration {
  readonly path: string;
  readonly integration: Integration;
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
      readonly warnings: readonly ConfigurationProblem[];
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const becauseOf = (error: unknown): string =>
  error instanceof InvalidIntegrationError ||
  error instanceof InvalidIntegrationPartError ||
  error instanceof InvalidIdentifierError
    ? error.because
    : reasoned(error);

const AS_CEL: Record<ToolInputType, string> = {
  string: 'string',
  number: 'dyn',
  boolean: 'bool',
};

const SECRET_IN = new RegExp(`secret\\.(${SECRET_NAME_SHAPE})`, 'g');

const secretsIn = (text: string): string[] =>
  [...text.matchAll(SECRET_IN)].map((match) => match[1] as string);

const doubted = (doubt: string, scope: Scope): string =>
  doubt.startsWith('Unknown variable')
    ? `does not check: ${doubt}. Here it may read ${scope.names.join(', ')}`
    : `does not check: ${doubt}`;

class Compiler {
  readonly problems: ConfigurationProblem[] = [];
  readonly warnings: ConfigurationProblem[] = [];
  readonly secrets = new Set<string>();
  private readonly typedScopes = new WeakMap<Scope, Scope>();

  constructor(
    private readonly path: string,
    private readonly types: readonly NamedType[] = [],
    private readonly hinting = false,
  ) {}

  private typed(scope: Scope): Scope {
    if (this.types.length === 0) {
      return scope;
    }

    const held = this.typedScopes.get(scope) ?? scope.typed(this.types);
    this.typedScopes.set(scope, held);

    return held;
  }

  part<T>(at: string, build: () => T): T | null {
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
    where: string,
    source: SourceKey,
  ): DeclaredHappening | null {
    const happening = this.part(`${where}.raise.happening`, () =>
      source.claim(HappeningName.of(event.raise.happening)),
    );
    const opens = event.raise.opens;
    const opening = opens
      ? this.part(`${where}.raise.opens`, () =>
          Opening.of({ onto: opens.onto, at: opens.at ?? null }),
        )
      : null;

    if (!happening || (opens && !opening)) {
      return null;
    }

    return this.part(`${where}.raise`, () =>
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

  expression(held: string, at: string, scope: Scope): Expression | null {
    for (const name of secretsIn(held)) {
      this.secrets.add(name);
    }

    try {
      const compiled = compileExpression(written(held), {
        scope: this.typed(scope),
        at,
      });

      if (compiled.doubt) {
        this.warnings.push(
          ConfigurationProblem.of({
            path: this.path,
            at,
            reason: doubted(compiled.doubt, scope),
            severity: 'warning',
          }),
        );
      }

      return compiled;
    } catch (error) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at,
          reason:
            error instanceof ExpressionError ? error.message : reasoned(error),
        }),
      );

      return null;
    }
  }

  templated(held: string, at: string, scope: Scope): Templated {
    if (isExpression(held)) {
      const whole = this.expression(held, at, scope);

      return { parts: whole ? [whole] : [] };
    }

    const parts: (string | Expression)[] = [];
    let from = 0;

    for (const found of held.matchAll(PIECE)) {
      const start = found.index ?? 0;

      if (start > from) {
        parts.push(held.slice(from, start));
      }

      const piece = this.expression(found[0], at, scope);
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

  structured(held: unknown, at: string, scope: Scope): Structured {
    if (typeof held === 'string') {
      return { kind: 'templated', templated: this.templated(held, at, scope) };
    }

    if (Array.isArray(held)) {
      return {
        kind: 'list',
        items: held.map((each, index) =>
          this.structured(each, `${at}.${index}`, scope),
        ),
      };
    }

    if (held !== null && typeof held === 'object') {
      return {
        kind: 'map',
        entries: Object.entries(held).map(([key, each]) => ({
          key,
          value: this.structured(each, `${at}.${key}`, scope),
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
    at: string,
    scope: Scope,
  ): Freshness | null {
    if (!freshness) {
      return null;
    }

    return {
      at: this.expression(freshness.at, `${at}.at`, scope) as Expression,
      within: Number.parseInt(freshness.within, 10),
    };
  }

  auth(auth: AuthFile, at: string, scope: Scope): AuthIR {
    if (auth.hmac) {
      this.secrets.add(secretOf(auth.hmac.secret));

      return {
        kind: 'hmac',
        algorithm: auth.hmac.algorithm,
        secret: secretOf(auth.hmac.secret),
        signed: auth.hmac.signed
          ? this.expression(auth.hmac.signed, `${at}.hmac.signed`, scope)
          : null,
        encoding: auth.hmac.encoding,
        prefix: auth.hmac.prefix,
        header: auth.hmac.header ?? null,
        freshness: this.freshness(
          auth.hmac.freshness,
          `${at}.hmac.freshness`,
          scope,
        ),
      };
    }

    if (auth.token) {
      this.secrets.add(secretOf(auth.token.secret));

      return {
        kind: 'token',
        secret: secretOf(auth.token.secret),
        header: auth.token.header ?? null,
        scheme: auth.token.scheme,
      };
    }

    if (auth.basic) {
      return {
        kind: 'basic',
        username: this.templated(
          auth.basic.username,
          `${at}.basic.username`,
          scope,
        ),
        password: this.templated(
          auth.basic.password,
          `${at}.basic.password`,
          scope,
        ),
      };
    }

    if (auth.asymmetric) {
      return {
        kind: 'asymmetric',
        algorithm: auth.asymmetric.algorithm,
        key: this.templated(auth.asymmetric.key, `${at}.asymmetric.key`, scope),
        signed: auth.asymmetric.signed
          ? this.expression(
              auth.asymmetric.signed,
              `${at}.asymmetric.signed`,
              scope,
            )
          : null,
        encoding: auth.asymmetric.encoding,
        header: auth.asymmetric.header ?? null,
        freshness: this.freshness(
          auth.asymmetric.freshness,
          `${at}.asymmetric.freshness`,
          scope,
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

  request(request: RequestFile, at: string, scope: Scope): RequestIR {
    const replied =
      this.hinting && request.response
        ? answered(scope).and({
            response: { schema: request.response as SchemaFields },
          })
        : answered(scope);

    return {
      method: request.method,
      url: this.templated(request.url, `${at}.url`, scope),
      query: Object.entries(request.query).map(([name, value]) => ({
        name,
        value: this.templated(value, `${at}.query.${name}`, scope),
      })),
      headers: Object.entries(request.headers).map(([name, value]) => ({
        name,
        value: this.templated(value, `${at}.headers.${name}`, scope),
      })),
      body:
        request.body !== undefined
          ? this.structured(request.body, `${at}.body`, scope)
          : null,
      auth: request.auth ? this.auth(request.auth, `${at}.auth`, scope) : null,
      expect: request.expect
        ? {
            success: request.expect.success
              ? this.expression(
                  request.expect.success,
                  `${at}.expect.success`,
                  replied,
                )
              : null,
            status: request.expect.status ?? null,
          }
        : null,
      capture: Object.entries(request.capture ?? {}).map(([name, value]) => ({
        name,
        value: this.expression(
          value,
          `${at}.capture.${name}`,
          replied,
        ) as Expression,
      })),
    };
  }

  event(event: EventFile, where: string, trigger: Scope): EventIR {
    const each = event.forEach ? iterating(trigger) : trigger;
    const looked = requesting(each);
    const kept = Object.keys(event.lookup?.capture ?? {});

    return {
      forEach: event.forEach
        ? this.expression(event.forEach, `${where}.forEach`, trigger)
        : null,
      when: this.expression(event.when, `${where}.when`, each) as Expression,
      lookup: event.lookup
        ? {
            request: this.request(
              event.lookup.request,
              `${where}.lookup.request`,
              looked,
            ),
            capture: Object.entries(event.lookup.capture).map(
              ([name, value]) => ({
                name,
                value: this.expression(
                  value,
                  `${where}.lookup.capture.${name}`,
                  answered(looked),
                ) as Expression,
              }),
            ),
          }
        : null,
      raise: this.raise(event.raise, `${where}.raise`, capturing(each, kept)),
    };
  }

  raise(raise: RaiseFile, at: string, scope: Scope): RaiseIR {
    const carried = attaching(scope);

    return {
      happening: raise.happening,
      spoken: raise.spoken,
      say: raise.say ? this.expression(raise.say, `${at}.say`, scope) : null,
      opens: raise.opens
        ? {
            onto: raise.opens.onto,
            at: raise.opens.at ?? null,
            title: this.expression(
              raise.opens.title,
              `${at}.opens.title`,
              scope,
            ) as Expression,
            description: raise.opens.description
              ? this.expression(
                  raise.opens.description,
                  `${at}.opens.description`,
                  scope,
                )
              : null,
            assignBy: raise.opens.assignBy
              ? {
                  email: this.expression(
                    raise.opens.assignBy.email,
                    `${at}.opens.assignBy.email`,
                    scope,
                  ) as Expression,
                }
              : null,
          }
        : null,
      branch: raise.branch
        ? this.expression(raise.branch, `${at}.branch`, scope)
        : null,
      marks: raise.marks.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: this.expression(
          mark.value,
          `${at}.marks.${index}.value`,
          scope,
        ) as Expression,
        finds: mark.find,
      })),
      attaches: raise.attaches
        ? {
            each: this.expression(
              raise.attaches.each,
              `${at}.attaches.each`,
              scope,
            ) as Expression,
            name: this.expression(
              raise.attaches.name,
              `${at}.attaches.name`,
              carried,
            ) as Expression,
            type: raise.attaches.type
              ? this.expression(
                  raise.attaches.type,
                  `${at}.attaches.type`,
                  carried,
                )
              : null,
            size: raise.attaches.size
              ? this.expression(
                  raise.attaches.size,
                  `${at}.attaches.size`,
                  carried,
                )
              : null,
            fetch: this.request(
              raise.attaches.fetch,
              `${at}.attaches.fetch`,
              requesting(carried),
            ),
          }
        : null,
    };
  }
}

const INTEGRATIONS = 'integrations';

const integrationAt = (source: string): string => `${INTEGRATIONS}/${source}`;

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

export const compileIntegration = (held: unknown): Compiled => {
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
  const compiler = new Compiler(
    path,
    hinting
      ? typeOrder.map(
          (name): NamedType => [name, file.types[name] as SchemaFields],
        )
      : [],
    hinting,
  );
  compiler.warnings.push(...hintWarnings);

  const delivered =
    hinting && file.webhook?.shape
      ? DELIVERED.and({ body: { schema: file.webhook.shape as SchemaFields } })
      : DELIVERED;
  const polled =
    hinting && file.poll?.shape
      ? POLLED.and({ body: { schema: file.poll.shape as SchemaFields } })
      : POLLED;
  const source = SourceKey.of(file.integration);

  const webhook: WebhookIR | null = file.webhook
    ? {
        verify: compiler.auth(file.webhook.verify, 'webhook.verify', delivered),
        respond: file.webhook.respond
          ? {
              when: compiler.expression(
                file.webhook.respond.when,
                'webhook.respond.when',
                delivered,
              ) as Expression,
              body: compiler.expression(
                file.webhook.respond.body,
                'webhook.respond.body',
                delivered,
              ) as Expression,
            }
          : null,
        mine: file.webhook.mine
          ? compiler.expression(file.webhook.mine, 'webhook.mine', delivered)
          : null,
        route: file.webhook.route
          ? compiler.expression(
              file.webhook.route.by,
              'webhook.route.by',
              delivered,
            )
          : null,
        parse: file.webhook.parse,
        delivery: file.webhook.delivery
          ? compiler.expression(
              file.webhook.delivery,
              'webhook.delivery',
              delivered,
            )
          : null,
        events: file.webhook.events.map((event, at) =>
          compiler.event(event, `webhook.events.${at}`, delivered),
        ),
      }
    : null;

  const poll: PollIR | null = file.poll
    ? {
        request: compiler.request(file.poll.request, 'poll.request', POLLING),
        cursor: file.poll.cursor
          ? compiler.expression(file.poll.cursor, 'poll.cursor', polled)
          : null,
        events: file.poll.events.map((event, at) =>
          compiler.event(event, `poll.events.${at}`, polled),
        ),
      }
    : null;

  const inputsOf = new Map<string, Record<string, string>>();
  for (const tool of Object.values(file.tools)) {
    const held = inputsOf.get(tool.does) ?? {};
    for (const [name, input] of Object.entries(tool.inputs)) {
      const type = AS_CEL[input.type];
      held[name] =
        held[name] === undefined || held[name] === type ? type : 'dyn';
    }
    inputsOf.set(tool.does, held);
  }

  const actions = new Map<string, RequestIR>();
  for (const [name, action] of Object.entries(file.actions)) {
    actions.set(
      name,
      compiler.request(
        action.request,
        `actions.${name}.request`,
        inputsOf.has(name)
          ? withInputs(ACTING, inputsOf.get(name) ?? {})
          : ACTING,
      ),
    );
  }

  const defined = compiler.part('actions', () =>
    DefinedActions.of(Object.keys(file.actions)),
  );

  const tools = new Map<string, ToolIR>();
  for (const [name, tool] of Object.entries(file.tools)) {
    const at = `tools.${name}`;

    compiler.part(`${at}.does`, () => defined?.named(tool.does, at));

    const inputs = inputsOf.get(tool.does) ?? {};

    tools.set(name, {
      name,
      inputs: Object.entries(tool.inputs).map(([input, declared]) => ({
        name: input,
        type: declared.type,
        description: declared.description ?? null,
        required: declared.required,
        piped: declared.piped,
        default:
          declared.default !== undefined
            ? compiler.templated(
                declared.default,
                `${at}.inputs.${input}.default`,
                DEFAULTING,
              )
            : null,
      })),
      output: tool.output
        ? compiler.expression(
            tool.output,
            `${at}.output`,
            answered(withInputs(ACTING, inputs)).and({
              capture: 'map<string, dyn>',
            }),
          )
        : null,
    });
  }

  const connection: ConnectionIR | null = file.connection
    ? {
        oauth2: file.connection.oauth2
          ? {
              authorize: file.connection.oauth2.authorize,
              token: file.connection.oauth2.token,
              scopes: file.connection.oauth2.scopes,
              identity: file.connection.oauth2.identity
                ? compiler.expression(
                    file.connection.oauth2.identity,
                    'connection.oauth2.identity',
                    LINKED,
                  )
                : null,
            }
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

  const schedule = file.schedule
    ? (() => {
        const written = file.schedule;
        const cron = compiler.part('schedule.cron', () =>
          CronExpression.of(written.cron, cronCalendar),
        );
        const does = compiler.part('schedule.do', () =>
          defined?.named(written.do, 'schedule'),
        );

        return cron && does ? Schedule.of({ cron, does }) : null;
      })()
    : null;

  const bindings: Binding[] = [];
  const on: OnBindingIR[] = Object.entries(file.on).map(([event, binding]) => {
    const bound = compiler.part(`on.${event}`, () =>
      Binding.of({ event, does: binding.do, known: ON_EVENTS }),
    );
    const does = compiler.part(`on.${event}.do`, () =>
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
          `on.${event}.to.${name}`,
          ADDRESSING,
        ) as Expression,
      })),
      routes: new Map(Object.entries(binding.routes)),
      mark: binding.mark.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: compiler.expression(
          mark.value,
          `on.${event}.mark.${index}.value`,
          MARKING,
        ) as Expression,
      })),
    };
  });

  const webhookDeclares = (file.webhook?.events ?? []).map((event, at) =>
    compiler.declared(event, `webhook.events.${at}`, source),
  );
  const pollDeclares = (file.poll?.events ?? []).map((event, at) =>
    compiler.declared(event, `poll.events.${at}`, source),
  );
  const approvalOf = (
    written: { because: string } | undefined,
    name: string,
  ): ApprovalNeeded | null =>
    written ? ApprovalNeeded.of(written, `tools.${name}.approval`) : null;

  const offers = [...tools.values()].map((tool) =>
    compiler.part(`tools.${tool.name}`, () =>
      OfferedTool.of({
        source,
        name: tool.name,
        description: file.tools[tool.name]?.description ?? '',
        does: file.tools[tool.name]?.does ?? '',
        approval: approvalOf(file.tools[tool.name]?.approval, tool.name),
        inputs: tool.inputs.map((input) => ({
          name: input.name,
          type: input.type,
          description: input.description,
          required: input.required,
          defaulted: input.default !== null,
          piped: input.piped,
        })),
      }),
    ),
  );

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
      credentials: [...compiler.secrets].map((name) => SecretName.of(name)),
      offers: offers.filter(isPresent),
    });

    return {
      ok: true,
      readable: {
        path,
        integration,
        webhook,
        poll,
        connection,
        actions,
        on,
        tools,
      },
      definition: file,
      warnings: compiler.warnings,
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: '',
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
  const shapes: [Shape, string][] = [
    ...Object.entries(file.types).map(([name, shape]): [Shape, string] => [
      shape as Shape,
      `types.${name}`,
    ]),
    ...(file.webhook?.shape
      ? [[file.webhook.shape as Shape, 'webhook.shape'] as [Shape, string]]
      : []),
    ...(file.poll?.shape
      ? [[file.poll.shape as Shape, 'poll.shape'] as [Shape, string]]
      : []),
    ...(file.poll?.request.response
      ? [
          [file.poll.request.response as Shape, 'poll.request.response'] as [
            Shape,
            string,
          ],
        ]
      : []),
    ...Object.entries(file.actions).flatMap(([name, action]) =>
      action.request.response
        ? [
            [
              action.request.response as Shape,
              `actions.${name}.request.response`,
            ] as [Shape, string],
          ]
        : [],
    ),
  ];

  const refused = shapes.flatMap(([shape, at]) =>
    refusedHints(shape, at, known),
  );
  const { cycle } = orderedTypes(file.types as Record<string, Shape>);

  return [
    ...refused,
    ...(cycle
      ? [
          {
            at: `types.${cycle}`,
            reason:
              'names itself, however far round, which a check cannot follow',
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
  compile(held: unknown): CompiledIntegration {
    const compiled = compileIntegration(held);

    return compiled.ok
      ? {
          ok: true,
          integration: compiled.readable.integration,
          document: DefinitionDocument.of(compiled.definition),
          warnings: compiled.warnings,
        }
      : compiled;
  }
}
