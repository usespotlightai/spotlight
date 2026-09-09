import { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { Integration } from '@domain/entities/integration.entity';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { MarkKind } from '@domain/value-objects/mark-kind.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import {
  compile as compileExpression,
  type Expression,
  ExpressionError,
} from '@infrastructure/integrations/expression';
import {
  type AuthFile,
  type EventFile,
  integrationSchema,
  isExpression,
  ON_EVENTS,
  type RaiseFile,
  type RequestFile,
  secretOf,
  written,
} from '@infrastructure/integrations/integration.schema';
import { CronTime } from 'cron';
import { parse as parseYaml } from 'yaml';

// ── The Integration IR: what the runtimes execute. Expressions are compiled
// here so a bad one is a problem with the file, not a delivery that fails at
// midnight; the domain has the last word on the vocabulary. ─────────────────

/** A value that is a literal, or an expression evaluated per delivery/call. */
export interface Templated {
  readonly literal: string | null;
  readonly expression: Expression | null;
}

export interface Freshness {
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
  readonly body: Templated | null;
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
  readonly opens: {
    readonly onto: string;
    readonly at: string | null;
    readonly title: Expression;
    readonly description: Expression | null;
    /** The email of the member to assign the opened task to, where one matches. */
    readonly assignBy: { readonly email: Expression } | null;
  } | null;
  readonly branch: Expression | null;
  readonly marks: readonly { kind: MarkKind; value: Expression }[];
}

/** A call whose captures join the bindings before a word is raised. */
export interface LookupIR {
  readonly request: RequestIR;
  readonly capture: readonly { name: string; value: Expression }[];
}

export interface EventIR {
  /** A list, one word raised per item; each item bound as `item`. */
  readonly forEach: Expression | null;
  readonly when: Expression;
  readonly lookup: LookupIR | null;
  readonly raise: RaiseIR;
}

export interface WebhookIR {
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

export interface PollIR {
  /** How often to poll, in seconds. */
  readonly every: number;
  readonly request: RequestIR;
  /** What to remember of the response, to poll from next time. */
  readonly cursor: Expression | null;
  readonly events: readonly EventIR[];
}

export interface ScheduleIR {
  /** A five- or six-field cron expression, checked when the file is read. */
  readonly cron: string;
  /** The action to run when it comes round; one of the file's own. */
  readonly action: string;
}

export interface ConnectionIR {
  readonly oauth2: {
    readonly authorize: string;
    readonly token: string;
    readonly scopes: readonly string[];
    /** Read against the token response, for a name a person recognises. */
    readonly identity: Expression | null;
  } | null;
  readonly manual: { readonly secrets: readonly string[] } | null;
}

export interface OnBindingIR {
  readonly event: string;
  readonly action: string;
  readonly to: readonly { name: string; value: Expression }[];
  readonly routes: ReadonlyMap<string, string>;
  readonly mark: readonly { kind: MarkKind; value: Expression }[];
}

/** The whole integration, compiled. Named ReadableIntegration for its readers. */
export interface ReadableIntegration {
  readonly integration: Integration;
  readonly webhook: WebhookIR | null;
  readonly poll: PollIR | null;
  readonly schedule: ScheduleIR | null;
  readonly connection: ConnectionIR | null;
  readonly actions: ReadonlyMap<string, RequestIR>;
  readonly on: readonly OnBindingIR[];
}

export type Compiled =
  | { readonly ok: true; readonly readable: ReadableIntegration }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const SECRET_IN = /secret\.([A-Z][A-Z0-9_]{0,63})/g;

/** Every team secret a piece of text reads, so the runtime resolves just those. */
const secretsIn = (text: string): string[] =>
  [...text.matchAll(SECRET_IN)].map((match) => match[1] as string);

class Compiler {
  readonly problems: ConfigurationProblem[] = [];
  readonly secrets = new Set<string>();

  constructor(private readonly path: string) {}

  /** One expression, named by where in the file it sits. */
  expression(held: string, at: string): Expression | null {
    for (const name of secretsIn(held)) {
      this.secrets.add(name);
    }

    try {
      return compileExpression(written(held));
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

  /** A literal is kept as it is; an expression is compiled like any other. */
  templated(held: string, at: string): Templated {
    return isExpression(held)
      ? { literal: null, expression: this.expression(held, at) }
      : { literal: held, expression: null };
  }

  freshness(
    freshness: { at: string; within: string } | undefined,
    at: string,
  ): Freshness | null {
    if (!freshness) {
      return null;
    }

    return {
      at: this.expression(freshness.at, `${at}.at`) as Expression,
      within: Number.parseInt(freshness.within, 10),
    };
  }

  auth(auth: AuthFile, at: string): AuthIR {
    if (auth.hmac) {
      this.secrets.add(secretOf(auth.hmac.secret));

      return {
        kind: 'hmac',
        algorithm: auth.hmac.algorithm,
        secret: secretOf(auth.hmac.secret),
        signed: auth.hmac.signed
          ? this.expression(auth.hmac.signed, `${at}.hmac.signed`)
          : null,
        encoding: auth.hmac.encoding,
        prefix: auth.hmac.prefix,
        header: auth.hmac.header ?? null,
        freshness: this.freshness(auth.hmac.freshness, `${at}.hmac.freshness`),
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
        username: this.templated(auth.basic.username, `${at}.basic.username`),
        password: this.templated(auth.basic.password, `${at}.basic.password`),
      };
    }

    if (auth.asymmetric) {
      return {
        kind: 'asymmetric',
        algorithm: auth.asymmetric.algorithm,
        key: this.templated(auth.asymmetric.key, `${at}.asymmetric.key`),
        signed: auth.asymmetric.signed
          ? this.expression(auth.asymmetric.signed, `${at}.asymmetric.signed`)
          : null,
        encoding: auth.asymmetric.encoding,
        header: auth.asymmetric.header ?? null,
        freshness: this.freshness(
          auth.asymmetric.freshness,
          `${at}.asymmetric.freshness`,
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

  request(request: RequestFile, at: string): RequestIR {
    return {
      method: request.method,
      url: this.templated(request.url, `${at}.url`),
      query: Object.entries(request.query).map(([name, value]) => ({
        name,
        value: this.templated(value, `${at}.query.${name}`),
      })),
      headers: Object.entries(request.headers).map(([name, value]) => ({
        name,
        value: this.templated(value, `${at}.headers.${name}`),
      })),
      body: request.body ? this.templated(request.body, `${at}.body`) : null,
      auth: request.auth ? this.auth(request.auth, `${at}.auth`) : null,
      expect: request.expect
        ? {
            success: request.expect.success
              ? this.expression(request.expect.success, `${at}.expect.success`)
              : null,
            status: request.expect.status ?? null,
          }
        : null,
      capture: Object.entries(request.capture ?? {}).map(([name, value]) => ({
        name,
        value: this.expression(value, `${at}.capture.${name}`) as Expression,
      })),
    };
  }

  event(
    event: EventFile,
    where: string,
    source: SourceKey,
    sourceName: string,
  ): EventIR {
    if (
      !source.raises({ source: Happening.of(event.raise.happening).source })
    ) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at: `${where}.raise.happening`,
          reason: `must begin with ${sourceName}., because that is the source raising it`,
        }),
      );
    }

    if (!event.raise.branch && event.raise.marks.length === 0) {
      this.problems.push(
        ConfigurationProblem.of({
          path: this.path,
          at: `${where}.raise`,
          reason:
            'needs a branch or a mark, or nothing could find a task from it',
        }),
      );
    }

    return {
      forEach: event.forEach
        ? this.expression(event.forEach, `${where}.forEach`)
        : null,
      when: this.expression(event.when, `${where}.when`) as Expression,
      lookup: event.lookup
        ? {
            request: this.request(
              event.lookup.request,
              `${where}.lookup.request`,
            ),
            capture: Object.entries(event.lookup.capture).map(
              ([name, value]) => ({
                name,
                value: this.expression(
                  value,
                  `${where}.lookup.capture.${name}`,
                ) as Expression,
              }),
            ),
          }
        : null,
      raise: this.raise(event.raise, `${where}.raise`),
    };
  }

  raise(raise: RaiseFile, at: string): RaiseIR {
    return {
      happening: raise.happening,
      spoken: raise.spoken,
      opens: raise.opens
        ? {
            onto: raise.opens.onto,
            at: raise.opens.at ?? null,
            title: this.expression(
              raise.opens.title,
              `${at}.opens.title`,
            ) as Expression,
            description: raise.opens.description
              ? this.expression(
                  raise.opens.description,
                  `${at}.opens.description`,
                )
              : null,
            assignBy: raise.opens.assignBy
              ? {
                  email: this.expression(
                    raise.opens.assignBy.email,
                    `${at}.opens.assignBy.email`,
                  ) as Expression,
                }
              : null,
          }
        : null,
      branch: raise.branch
        ? this.expression(raise.branch, `${at}.branch`)
        : null,
      marks: raise.marks.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: this.expression(
          mark.value,
          `${at}.marks.${index}.value`,
        ) as Expression,
      })),
    };
  }
}

export const compileIntegration = (path: string, text: string): Compiled => {
  let held: unknown;

  try {
    held = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: `is not YAML: ${reasoned(error)}`,
        }),
      ],
    };
  }

  const read = integrationSchema.safeParse(held);

  if (!read.success) {
    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: issue.path.length > 0 ? issue.path.join('.') : 'the file',
          reason: issue.message,
        }),
      ),
    };
  }

  const file = read.data;
  const compiler = new Compiler(path);
  const source = SourceKey.of(file.integration);

  const webhook: WebhookIR | null = file.webhook
    ? {
        verify: compiler.auth(file.webhook.verify, 'webhook.verify'),
        respond: file.webhook.respond
          ? {
              when: compiler.expression(
                file.webhook.respond.when,
                'webhook.respond.when',
              ) as Expression,
              body: compiler.expression(
                file.webhook.respond.body,
                'webhook.respond.body',
              ) as Expression,
            }
          : null,
        mine: file.webhook.mine
          ? compiler.expression(file.webhook.mine, 'webhook.mine')
          : null,
        route: file.webhook.route
          ? compiler.expression(file.webhook.route.by, 'webhook.route.by')
          : null,
        parse: file.webhook.parse,
        delivery: file.webhook.delivery
          ? compiler.expression(file.webhook.delivery, 'webhook.delivery')
          : null,
        events: file.webhook.events.map((event, at) =>
          compiler.event(
            event,
            `webhook.events.${at}`,
            source,
            file.integration,
          ),
        ),
      }
    : null;

  const poll: PollIR | null = file.poll
    ? {
        every: Number.parseInt(file.poll.every, 10),
        request: compiler.request(file.poll.request, 'poll.request'),
        cursor: file.poll.cursor
          ? compiler.expression(file.poll.cursor, 'poll.cursor')
          : null,
        events: file.poll.events.map((event, at) =>
          compiler.event(event, `poll.events.${at}`, source, file.integration),
        ),
      }
    : null;

  const actions = new Map<string, RequestIR>();
  for (const [name, action] of Object.entries(file.actions)) {
    actions.set(
      name,
      compiler.request(action.request, `actions.${name}.request`),
    );
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

  let schedule: ScheduleIR | null = null;
  if (file.schedule) {
    try {
      // Reading the cron is how it is checked: a bad one is a problem with the
      // file, not a job that never wakes.
      new CronTime(file.schedule.cron);
      schedule = { cron: file.schedule.cron, action: file.schedule.do };
    } catch (error) {
      compiler.problems.push(
        ConfigurationProblem.of({
          path,
          at: 'schedule.cron',
          reason: `is not a cron expression: ${reasoned(error)}`,
        }),
      );
    }

    if (!actions.has(file.schedule.do)) {
      compiler.problems.push(
        ConfigurationProblem.of({
          path,
          at: 'schedule.do',
          reason: `names an action "${file.schedule.do}" that is not defined`,
        }),
      );
    }
  }

  const on: OnBindingIR[] = Object.entries(file.on).map(([event, binding]) => {
    if (!(ON_EVENTS as readonly string[]).includes(event)) {
      compiler.problems.push(
        ConfigurationProblem.of({
          path,
          at: `on.${event}`,
          reason: `is not an event Spotlight raises; expected one of ${ON_EVENTS.join(', ')}`,
        }),
      );
    }

    if (!actions.has(binding.do)) {
      compiler.problems.push(
        ConfigurationProblem.of({
          path,
          at: `on.${event}.do`,
          reason: `names an action "${binding.do}" that is not defined`,
        }),
      );
    }

    return {
      event,
      action: binding.do,
      to: Object.entries(binding.to).map(([name, value]) => ({
        name,
        value: compiler.expression(
          value,
          `on.${event}.to.${name}`,
        ) as Expression,
      })),
      routes: new Map(Object.entries(binding.routes)),
      mark: binding.mark.map((mark, index) => ({
        kind: MarkKind.of(mark.kind),
        value: compiler.expression(
          mark.value,
          `on.${event}.mark.${index}.value`,
        ) as Expression,
      })),
    };
  });

  if (compiler.problems.length > 0) {
    return { ok: false, problems: compiler.problems };
  }

  // The domain has the last word on whether these are a vocabulary. What it
  // refuses comes back as a problem with the file, because that is what it is.
  try {
    const integration = Integration.of({
      source,
      name: file.name,
      connects: connection?.oauth2 !== null && connection?.oauth2 !== undefined,
      credentials: [...compiler.secrets].map((name) => SecretName.of(name)),
      declares: [
        ...(file.webhook?.events ?? []),
        ...(file.poll?.events ?? []),
      ].map((event) =>
        DeclaredHappening.of({
          happening: Happening.of(event.raise.happening),
          label: event.raise.label ?? event.raise.happening,
          told: event.raise.told ?? event.raise.happening,
          spoken: event.raise.spoken,
          finds: event.raise.marks.map((mark) => MarkKind.of(mark.kind)),
          findsByBranch: event.raise.branch !== undefined,
          opensOnto: event.raise.opens
            ? LineRole.of(event.raise.opens.onto)
            : null,
          opensAt: event.raise.opens?.at
            ? StationKey.of(event.raise.opens.at)
            : null,
        }),
      ),
    });

    return {
      ok: true,
      readable: {
        integration,
        webhook,
        poll,
        schedule,
        connection,
        actions,
        on,
      },
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: reasoned(error),
        }),
      ],
    };
  }
};
