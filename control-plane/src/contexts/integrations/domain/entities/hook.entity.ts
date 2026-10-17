import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
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

interface HookFields {
  readonly key: HookKey;
  readonly event: HookEvent;
  readonly match: HookMatch;
  readonly steps: readonly HookStep[];
  readonly signing: HookSigning | null;
  readonly failure: HookOnFailure;
  readonly timeoutSeconds: number;
}

export interface StepEnded {
  readonly denyReason: string | null;
  readonly failedBecause: string | null;
}

const DEFAULTS = {
  failure: 'continue',
  timeoutSeconds: 10,
} as const satisfies Pick<HookFields, 'failure' | 'timeoutSeconds'>;

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

const guardMatch = (fields: HookFields): void => {
  if (fields.match.tools.length > 0 && !fields.event.aboutTool) {
    throw new InvalidHookError(
      at('match', 'tools'),
      `only applies to tool.using and tool.used, not ${fields.event.name}`,
    );
  }

  if (fields.match.paths.length > 0 && !fields.event.aboutChanges) {
    throw new InvalidHookError(
      at('match', 'paths'),
      `only applies to pull-request.opening and pull-request.merged, not ${fields.event.name}`,
    );
  }
};

const guardStep = (step: HookStep, index: number): void => {
  if (!STEP_NAME.test(step.name)) {
    throw new InvalidHookError(
      at('steps', index, 'name'),
      'must be lowercase words joined by dashes, as in notify',
    );
  }

  if (
    step.kind === 'request' &&
    step.url &&
    sendsInTheClear(step.url, step.fromNetwork)
  ) {
    throw new InvalidHookError(
      at('steps', index, 'request', 'url'),
      'must be https unless sent from the team’s network',
    );
  }
};

const guardSteps = (fields: HookFields): void => {
  if (fields.steps.length === 0) {
    throw new InvalidHookError(at('steps'), 'must not be empty');
  }

  const seen = new Set<string>();

  fields.steps.forEach((step, index) => {
    guardStep(step, index);

    if (seen.has(step.name)) {
      throw new InvalidHookError(
        at('steps', index, 'name'),
        `repeats the name ${step.name}`,
      );
    }

    seen.add(step.name);
  });

  if (
    fields.signing === null &&
    fields.steps.some((step) => step.kind === 'request')
  ) {
    throw new InvalidHookError(
      at('signing'),
      'is required for a hook that makes requests',
    );
  }
};

const guardFailure = (fields: HookFields): void => {
  if (fields.failure === 'block' && !fields.event.isBefore) {
    throw new InvalidHookError(
      at('failure'),
      `cannot be block after ${fields.event.name} has happened`,
    );
  }

  if (
    !Number.isInteger(fields.timeoutSeconds) ||
    fields.timeoutSeconds < SHORTEST_TIMEOUT ||
    fields.timeoutSeconds > LONGEST_TIMEOUT
  ) {
    throw new InvalidHookError(
      at('timeoutSeconds'),
      `must be a whole number of seconds from ${SHORTEST_TIMEOUT} to ${LONGEST_TIMEOUT}`,
    );
  }
};

export class Hook {
  static readonly DEFAULTS = DEFAULTS;

  private constructor(private readonly fields: HookFields) {}

  static of(fields: HookFields): Hook {
    guardMatch(fields);
    guardSteps(fields);
    guardFailure(fields);

    return new Hook({
      ...fields,
      match: {
        tools: uniqueNames(fields.match.tools),
        paths: [...fields.match.paths],
      },
      steps: fields.steps.map((step) => ({ ...step })),
    });
  }

  get key(): HookKey {
    return this.fields.key;
  }

  get event(): HookEvent {
    return this.fields.event;
  }

  get failure(): HookOnFailure {
    return this.fields.failure;
  }

  get blocks(): boolean {
    return this.fields.failure === 'block';
  }

  get signing(): HookSigning | null {
    return this.fields.signing;
  }

  get steps(): readonly HookStep[] {
    return this.fields.steps;
  }

  get timeoutSeconds(): number {
    return this.fields.timeoutSeconds;
  }

  get tools(): readonly ToolName[] {
    return uniqueNames([
      ...this.fields.match.tools,
      ...this.fields.steps.flatMap((step) =>
        step.kind === 'call' ? [step.tool] : [],
      ),
    ]).sort((one, other) => (one.value < other.value ? -1 : 1));
  }

  get matchedTools(): readonly ToolName[] {
    return this.fields.match.tools;
  }

  get requestsFromNetwork(): boolean {
    return this.fields.steps.some(
      (step) => step.kind === 'request' && step.fromNetwork,
    );
  }

  callDenial(
    named: ToolName,
    provided: ProvidedTool | null,
  ): HookFailure | null {
    if (provided === null || provided.tool !== named.value) {
      return HookFailure.of(
        'not-allowed',
        `names ${named.value}, which no integration of the team offers now`,
      );
    }

    if (provided.approval) {
      return HookFailure.of(
        'not-allowed',
        `calls ${named.value}, which needs a person's approval before each call. A hook cannot approve the call`,
      );
    }

    return null;
  }

  requestDenial(step: string, url: URL): HookFailure | null {
    const fromNetwork = this.fields.steps.some(
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

  decisionOn(step: string, ended: StepEnded): HookDecision | null {
    const hook = this.fields.key.value;

    if (ended.denyReason !== null) {
      return HookDecision.denied(
        `Hook ${hook} denied the event. Reason: ${ended.denyReason}`,
      );
    }

    if (ended.failedBecause === null) {
      return null;
    }

    return this.blocks
      ? HookDecision.denied(
          `Hook ${hook} failed at step ${step} and blocks on failure. Reason: ${ended.failedBecause}`,
        )
      : HookDecision.allowed();
  }
}
