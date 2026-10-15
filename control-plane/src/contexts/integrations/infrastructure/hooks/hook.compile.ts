import {
  HOOKS,
  hookAt,
} from '@integrations/application/rendering/hook-problems';
import {
  Hook,
  type HookSigning,
  type HookStep,
} from '@integrations/domain/entities/hook.entity';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import {
  HookEvent,
  type HookEventName,
} from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  type HookFile,
  type HookStepFile,
  hookSchema,
} from '@integrations/infrastructure/hooks/hook.schema';
import {
  firingScope,
  steppingScope,
} from '@integrations/infrastructure/hooks/hook-scopes';
import {
  isExpression,
  written,
} from '@integrations/infrastructure/integrations/integration.schema';
import {
  PIECE,
  type Structured,
  type Templated,
} from '@integrations/infrastructure/integrations/templating';
import { ExpressionError } from '@platform/expressions/expression.errors';
import type {
  Expression,
  ExpressionEnginePort,
  ExpressionSpan,
} from '@platform/expressions/expression-engine.port';
import type { Scope } from '@platform/expressions/scope';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export type Returns = 'bool' | null;

interface HookPlace {
  readonly scope: Scope;
  readonly returns: Returns;
}

interface HookExpressionError {
  readonly message: string;
  readonly span: ExpressionSpan | null;
  readonly suggestion: string | null;
}

export interface HookVerdict {
  readonly type: string | null;
  readonly errors: readonly HookExpressionError[];
}

export type HookStepIR =
  | {
      readonly name: string;
      readonly kind: 'call';
      readonly tool: string;
      readonly with: Structured;
    }
  | {
      readonly name: string;
      readonly kind: 'request';
      readonly url: Templated;
      readonly headers: readonly {
        readonly name: string;
        readonly value: Templated;
      }[];
      readonly body: Structured | null;
      readonly fromNetwork: boolean;
    };

export type HookSigningIR =
  | { readonly kind: 'hmac' }
  | { readonly kind: 'oidc'; readonly audience: string };

export interface HookIR {
  readonly hook: Hook;
  readonly on: HookEventName;
  readonly conditions: readonly Expression[];
  readonly vars: Readonly<Record<string, string>>;
  readonly steps: readonly HookStepIR[];
  readonly signing: HookSigningIR | null;
}

export type CompiledHook =
  | {
      readonly ok: true;
      readonly ir: HookIR;
      readonly document: DefinitionDocument;
      readonly places: ReadonlyMap<string, HookPlace>;
    }
  | {
      readonly ok: false;
      readonly problems: readonly ConfigurationProblem[];
    };

const READS_A_SECRET = /(^|[^A-Za-z0-9_.])secret\s*(\.|\[)/;

const REGEX_SPECIAL = /[.+^${}()|[\]\\]/g;

const addressOf = (held: unknown): string => {
  const key = (held as { key?: unknown } | null)?.key;

  return typeof key === 'string' && key.trim() ? hookAt(key.trim()) : HOOKS;
};

export const globToRegex = (glob: string): string => {
  const whole = glob.endsWith('/') ? `${glob}**` : glob;
  let pattern = '';

  for (let at = 0; at < whole.length; at += 1) {
    const each = whole[at] as string;

    if (each === '*' && whole[at + 1] === '*') {
      pattern += '.*';
      at += 1;
    } else if (each === '*') {
      pattern += '[^/]*';
    } else if (each === '?') {
      pattern += '[^/]';
    } else {
      pattern += each.replace(REGEX_SPECIAL, '\\$&');
    }
  }

  return `^${pattern}$`;
};

const listed = (values: readonly string[]): string =>
  `[${values.map((each) => JSON.stringify(each)).join(', ')}]`;

const matchConditions = (file: HookFile, event: HookEvent): string[] => {
  const conditions: string[] = [];
  const { match } = file;

  if (match.tools.length > 0 && event.aboutTool) {
    conditions.push(`event.tool in ${listed(match.tools)}`);
  }

  if (match.lines.length > 0) {
    conditions.push(`task.line in ${listed(match.lines)}`);
  }

  if (match.stations.length > 0) {
    conditions.push(`task.stationKey in ${listed(match.stations)}`);
  }

  if (match.repositories.length > 0) {
    conditions.push(
      event.aboutChanges
        ? `event.repository in ${listed(match.repositories)}`
        : `task.repositories.exists(repository, repository in ${listed(match.repositories)})`,
    );
  }

  if (match.paths.length > 0 && event.aboutChanges) {
    conditions.push(
      `event.changed.exists(path, ${match.paths
        .map((glob) => `path.matches(${JSON.stringify(globToRegex(glob))})`)
        .join(' || ')})`,
    );
  }

  return conditions;
};

const staticUrl = (held: string): URL | null => {
  if (held.includes('${{')) {
    return null;
  }

  try {
    return new URL(held);
  } catch {
    return null;
  }
};

const wrote = (held: unknown, field: string): boolean =>
  typeof held === 'object' && held !== null && field in held;

const documented = (file: HookFile, held: unknown): DefinitionDocument => {
  const { failure, timeoutSeconds, ...rest } = file;

  return DefinitionDocument.of({
    ...rest,
    ...(wrote(held, 'failure') ? { failure } : {}),
    ...(wrote(held, 'timeoutSeconds') ? { timeoutSeconds } : {}),
    signing:
      file.signing && 'secretVersion' in file.signing
        ? { secretVersion: file.signing.secretVersion }
        : file.signing,
  });
};

const signingOf = (file: HookFile): HookSigningIR | null => {
  if (!file.signing) {
    return null;
  }

  return 'oidc' in file.signing
    ? { kind: 'oidc', audience: file.signing.oidc.audience }
    : { kind: 'hmac' };
};

class HookCompiler {
  readonly problems: ConfigurationProblem[] = [];
  readonly places = new Map<string, HookPlace>();

  constructor(
    private readonly expressions: ExpressionEnginePort,
    private readonly path: string,
  ) {}

  expression(
    held: string,
    at: FieldPath,
    scope: Scope,
    returns: Returns,
  ): Expression | null {
    if (READS_A_SECRET.test(held)) {
      this.problem(
        at,
        'reads a secret’s value. No hook may read a secret. A hook signs its requests with its own secret',
      );

      return null;
    }

    const source = isExpression(held) ? written(held) : held;
    const verdict = checkedAgainst(this.expressions, source, scope, returns);

    this.places.set(at.rendered, { scope, returns });

    for (const error of verdict.errors) {
      this.problem(at, error.message);
    }

    if (verdict.errors.length > 0) {
      return null;
    }

    try {
      return this.expressions.compile(source, { at: at.rendered });
    } catch (error) {
      this.problem(
        at,
        error instanceof ExpressionError ? error.message : String(error),
      );

      return null;
    }
  }

  templated(held: string, at: FieldPath, scope: Scope): Templated {
    if (isExpression(held)) {
      const whole = this.expression(held, at, scope, null);

      return { parts: whole ? [whole] : [] };
    }

    const parts: (string | Expression)[] = [];
    let from = 0;

    for (const found of held.matchAll(PIECE)) {
      const start = found.index ?? 0;

      if (start > from) {
        parts.push(held.slice(from, start));
      }

      const piece = this.expression(found[0], at, scope, null);
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

  structured(held: unknown, at: FieldPath, scope: Scope): Structured {
    if (typeof held === 'string') {
      return { kind: 'templated', templated: this.templated(held, at, scope) };
    }

    if (Array.isArray(held)) {
      return {
        kind: 'list',
        items: held.map((each, index) =>
          this.structured(each, at.to(index), scope),
        ),
      };
    }

    if (held !== null && typeof held === 'object') {
      return {
        kind: 'map',
        entries: Object.entries(held).map(([key, each]) => ({
          key,
          value: this.structured(each, at.to(key), scope),
        })),
      };
    }

    return {
      kind: 'value',
      value:
        typeof held === 'number' || typeof held === 'boolean' ? held : null,
    };
  }

  step(
    step: HookStepFile,
    index: number,
    on: HookEventName,
    earlier: readonly string[],
  ): HookStepIR {
    const at = FieldPath.of(['steps', index]);
    const scope = steppingScope(on, earlier);

    if (step.call !== undefined) {
      return {
        name: step.name,
        kind: 'call',
        tool: step.call,
        with: this.structured(step.with ?? {}, at.to('with'), scope),
      };
    }

    const request = step.request as NonNullable<HookStepFile['request']>;
    const place = at.to('request');

    return {
      name: step.name,
      kind: 'request',
      url: this.templated(request.url, place.to('url'), scope),
      headers: Object.entries(request.headers).map(([name, value]) => ({
        name: name.toLowerCase(),
        value: this.templated(value, place.to('headers', name), scope),
      })),
      body:
        request.body === undefined
          ? null
          : this.structured(request.body, place.to('body'), scope),
      fromNetwork: request.from === 'network',
    };
  }

  problem(at: FieldPath, reason: string): void {
    this.problems.push(
      ConfigurationProblem.of({ path: this.path, at, reason }),
    );
  }
}

export const checkedAgainst = (
  expressions: ExpressionEnginePort,
  source: string,
  scope: Scope,
  returns: Returns,
): HookVerdict => {
  const checked = expressions.check(source, scope);

  if (!checked.valid) {
    return {
      type: null,
      errors: [
        {
          message: checked.reason,
          span: checked.span,
          suggestion: checked.suggestion,
        },
      ],
    };
  }

  if (returns === 'bool' && checked.type !== 'bool' && checked.type !== 'dyn') {
    return {
      type: checked.type,
      errors: [
        {
          message: `must return a bool, not a ${checked.type}`,
          span: {
            start: source.length - source.trimStart().length,
            end: source.trimEnd().length,
          },
          suggestion: null,
        },
      ],
    };
  }

  return { type: checked.type, errors: [] };
};

const domainStep = (step: HookStepFile): HookStep =>
  step.call !== undefined
    ? { name: step.name, kind: 'call', tool: ToolName.of(step.call) }
    : {
        name: step.name,
        kind: 'request',
        url: staticUrl(step.request?.url ?? ''),
        fromNetwork: step.request?.from === 'network',
      };

const signingKind = (file: HookFile): HookSigning | null =>
  signingOf(file)?.kind ?? null;

export const compileHook = (
  held: unknown,
  expressions: ExpressionEnginePort,
): CompiledHook => {
  const path = addressOf(held);
  const read = hookSchema.safeParse(held);

  if (!read.success) {
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
  const on = file.on as HookEventName;
  const event = HookEvent.of(on);
  const compiler = new HookCompiler(expressions, path);
  let hook: Hook | null = null;

  try {
    hook = Hook.of({
      key: HookKey.of(file.key),
      event,
      match: {
        tools: file.match.tools.map((tool) => ToolName.of(tool)),
        paths: file.match.paths,
      },
      steps: file.steps.map(domainStep),
      signing: signingKind(file),
      failure: file.failure,
      timeoutSeconds: file.timeoutSeconds,
    });
  } catch (error) {
    if (!(error instanceof InvalidHookError)) {
      throw error;
    }

    compiler.problem(error.at, error.because);
  }

  const scope = firingScope(on);
  const conditions = matchConditions(file, event).map((source) =>
    compiler.expression(source, FieldPath.of(['match']), scope, 'bool'),
  );
  const when =
    file.when === undefined
      ? null
      : compiler.expression(file.when, FieldPath.of(['when']), scope, 'bool');
  const steps = file.steps.map((step, index) =>
    compiler.step(
      step,
      index,
      on,
      file.steps.slice(0, index).map((each) => each.name),
    ),
  );

  if (!hook || compiler.problems.length > 0) {
    return { ok: false, problems: compiler.problems };
  }

  return {
    ok: true,
    ir: {
      hook,
      on,
      conditions: [...conditions, when].filter(
        (each): each is Expression => each !== null,
      ),
      vars: file.vars,
      steps,
      signing: signingOf(file),
    },
    document: documented(file, held),
    places: compiler.places,
  };
};

export const secretIn = (
  held: unknown,
): { readonly secret: string | null; readonly version: number } | null => {
  const read = hookSchema.safeParse(held);

  if (
    !read.success ||
    !read.data.signing ||
    !('secretVersion' in read.data.signing)
  ) {
    return null;
  }

  return {
    secret: read.data.signing.secret ?? null,
    version: read.data.signing.secretVersion,
  };
};
