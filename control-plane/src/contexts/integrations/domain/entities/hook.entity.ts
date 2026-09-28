import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import type { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HOOK_ON_FAILURES = ['continue', 'block'] as const;

export type HookOnFailure = (typeof HOOK_ON_FAILURES)[number];

export type HookSigning = 'hmac' | 'oidc';

export type HookStep =
  | { readonly name: string; readonly kind: 'call'; readonly tool: ToolName }
  | {
      readonly name: string;
      readonly kind: 'request';
      readonly url: URL | null;
      readonly fromNetwork: boolean;
    };

interface HookMatch {
  readonly tools: readonly ToolName[];
  readonly paths: readonly string[];
}

interface Described {
  readonly key: HookKey;
  readonly event: HookEvent;
  readonly match: HookMatch;
  readonly steps: readonly HookStep[];
  readonly signing: HookSigning | null;
  readonly failure: HookOnFailure;
  readonly timeoutSeconds: number;
}

export interface StepEnded {
  readonly refusal: string | null;
  readonly failedBecause: string | null;
}

const DEFAULTS = {
  failure: 'continue',
  timeoutSeconds: 10,
} as const satisfies Pick<Described, 'failure' | 'timeoutSeconds'>;

const STEP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SHORTEST_TIMEOUT = 1;

const LONGEST_TIMEOUT = 30;

const at = (...segments: (string | number)[]) => FieldPath.of(segments);

const sendsInTheClear = (url: URL, fromNetwork: boolean): boolean =>
  url.protocol !== 'https:' && !fromNetwork;

const uniqueNames = (tools: readonly ToolName[]): ToolName[] =>
  tools.filter(
    (tool, index) => tools.findIndex((each) => each.equals(tool)) === index,
  );

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
    sendsInTheClear(step.url, step.fromNetwork)
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
  static readonly DEFAULTS = DEFAULTS;

  private constructor(private readonly described: Described) {}

  static of(described: Described): Hook {
    guardMatch(described);
    guardSteps(described);
    guardFailure(described);

    return new Hook({
      ...described,
      match: {
        tools: uniqueNames(described.match.tools),
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

  get failure(): HookOnFailure {
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

  get tools(): readonly ToolName[] {
    return uniqueNames([
      ...this.described.match.tools,
      ...this.described.steps.flatMap((step) =>
        step.kind === 'call' ? [step.tool] : [],
      ),
    ]).sort((one, other) => (one.value < other.value ? -1 : 1));
  }

  get matchedTools(): readonly ToolName[] {
    return this.described.match.tools;
  }

  get requestsFromNetwork(): boolean {
    return this.described.steps.some(
      (step) => step.kind === 'request' && step.fromNetwork,
    );
  }

  refusalToCall(
    named: ToolName,
    offered: OfferedTool | null,
  ): HookFailure | null {
    if (offered === null || offered.tool !== named.value) {
      return HookFailure.of(
        'not-allowed',
        `names ${named.value}, which no integration of the team offers now`,
      );
    }

    if (offered.approval) {
      return HookFailure.of(
        'not-allowed',
        `calls ${named.value}, which asks a person's approval before each call, and a hook cannot give it`,
      );
    }

    return null;
  }

  refusalToRequest(step: string, url: URL): HookFailure | null {
    const fromNetwork = this.described.steps.some(
      (each) =>
        each.name === step && each.kind === 'request' && each.fromNetwork,
    );

    return sendsInTheClear(url, fromNetwork)
      ? HookFailure.of(
          'not-allowed',
          `sends to ${url.origin}, which is not https`,
        )
      : null;
  }

  verdictOn(step: string, ended: StepEnded): HookVerdict | null {
    const hook = this.described.key.value;

    if (ended.refusal !== null) {
      return HookVerdict.refused(`The hook ${hook} refused: ${ended.refusal}`);
    }

    if (ended.failedBecause === null) {
      return null;
    }

    return this.blocks
      ? HookVerdict.refused(
          `The hook ${hook} failed at ${step} (${ended.failedBecause}), and it blocks on failure`,
        )
      : HookVerdict.allowed();
  }
}
