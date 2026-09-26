import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export type HookFailure = 'continue' | 'block';

export type HookSigning = 'hmac' | 'oidc';

export type HookStep =
  | { readonly name: string; readonly kind: 'call'; readonly tool: string }
  | {
      readonly name: string;
      readonly kind: 'request';
      readonly url: URL | null;
      readonly fromNetwork: boolean;
    };

interface HookMatch {
  readonly tools: readonly string[];
  readonly paths: readonly string[];
}

interface Described {
  readonly key: HookKey;
  readonly event: HookEvent;
  readonly match: HookMatch;
  readonly steps: readonly HookStep[];
  readonly signing: HookSigning | null;
  readonly failure: HookFailure;
  readonly timeoutSeconds: number;
}

const STEP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SHORTEST_TIMEOUT = 1;

const LONGEST_TIMEOUT = 30;

const at = (...segments: (string | number)[]) => FieldPath.of(segments);

const guardMatch = (described: Described): void => {
  if (described.match.tools.length > 0 && !described.event.aboutTool) {
    throw new InvalidHookError(
      at('match', 'tools'),
      `matches tools, but ${described.event.name} is not about a tool; tools match only on tool.using and tool.used`,
    );
  }

  if (described.match.paths.length > 0 && !described.event.aboutChanges) {
    throw new InvalidHookError(
      at('match', 'paths'),
      `matches changed paths, but ${described.event.name} changes no files; paths match only on pull-request.opening and pull-request.merged`,
    );
  }
};

const guardStep = (step: HookStep, index: number): void => {
  if (!STEP_NAME.test(step.name)) {
    throw new InvalidHookError(
      at('steps', index, 'name'),
      'is lower case words joined by dashes, as in notify',
    );
  }

  if (
    step.kind === 'request' &&
    step.url &&
    step.url.protocol !== 'https:' &&
    !step.fromNetwork
  ) {
    throw new InvalidHookError(
      at('steps', index, 'request', 'url'),
      'is not https; only a request made from the team’s own network may be plain http',
    );
  }
};

const guardSteps = (described: Described): void => {
  if (described.steps.length === 0) {
    throw new InvalidHookError(
      at('steps'),
      'is empty; a hook needs at least one step to call a tool or make a request',
    );
  }

  const seen = new Set<string>();

  described.steps.forEach((step, index) => {
    guardStep(step, index);

    if (seen.has(step.name)) {
      throw new InvalidHookError(
        at('steps', index, 'name'),
        `repeats ${step.name}; each step has its own name so later steps can read its output`,
      );
    }

    seen.add(step.name);
  });

  if (
    described.signing === null &&
    described.steps.some((step) => step.kind === 'request')
  ) {
    throw new InvalidHookError(
      at('signing'),
      'is missing; a hook that makes requests signs them, so the endpoint can tell they came from Spotlight',
    );
  }
};

const guardFailure = (described: Described): void => {
  if (described.failure === 'block' && !described.event.isBefore) {
    throw new InvalidHookError(
      at('failure'),
      `is block, but ${described.event.name} has already happened by the time the hook runs; only a hook before an event can block it`,
    );
  }

  if (
    !Number.isInteger(described.timeoutSeconds) ||
    described.timeoutSeconds < SHORTEST_TIMEOUT ||
    described.timeoutSeconds > LONGEST_TIMEOUT
  ) {
    throw new InvalidHookError(
      at('timeoutSeconds'),
      `is a whole number of seconds from ${SHORTEST_TIMEOUT} to ${LONGEST_TIMEOUT}`,
    );
  }
};

export class Hook {
  private constructor(private readonly described: Described) {}

  static of(described: Described): Hook {
    guardMatch(described);
    guardSteps(described);
    guardFailure(described);

    return new Hook({
      ...described,
      match: {
        tools: [...new Set(described.match.tools)],
        paths: [...described.match.paths],
      },
      steps: described.steps.map((step) => ({ ...step })),
    });
  }

  get key(): HookKey {
    return this.described.key;
  }

  get event(): HookEvent {
    return this.described.event;
  }

  get failure(): HookFailure {
    return this.described.failure;
  }

  get blocks(): boolean {
    return this.described.failure === 'block';
  }

  get signing(): HookSigning | null {
    return this.described.signing;
  }

  get steps(): readonly HookStep[] {
    return this.described.steps;
  }

  get timeoutSeconds(): number {
    return this.described.timeoutSeconds;
  }

  get tools(): readonly string[] {
    return [
      ...new Set([
        ...this.described.match.tools,
        ...this.described.steps.flatMap((step) =>
          step.kind === 'call' ? [step.tool] : [],
        ),
      ]),
    ].sort();
  }

  get matchedTools(): readonly string[] {
    return this.described.match.tools;
  }

  get requestsFromNetwork(): boolean {
    return this.described.steps.some(
      (step) => step.kind === 'request' && step.fromNetwork,
    );
  }
}
