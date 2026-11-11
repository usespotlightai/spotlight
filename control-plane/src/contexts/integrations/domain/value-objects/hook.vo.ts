import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import type { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type {
  HookMatch,
  MatchedTask,
} from '@integrations/domain/value-objects/hook-match.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HOOK_ON_FAILURES = ['continue', 'block'] as const;

export type HookOnFailure = (typeof HOOK_ON_FAILURES)[number];

export type HookSigning = 'hmac' | 'oidc';

export type HookStep =
  | {
      readonly name: HookStepName;
      readonly kind: 'call';
      readonly tool: ToolName;
    }
  | {
      readonly name: HookStepName;
      readonly kind: 'request';
      readonly url: URL | null;
      readonly headers: readonly string[];
      readonly fromNetwork: boolean;
    };

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

export type HookRequestOrigin = 'spotlight' | 'network';

const DEFAULTS = {
  failure: 'continue',
  timeoutSeconds: 10,
  from: 'spotlight',
} as const satisfies Pick<HookFields, 'failure' | 'timeoutSeconds'> & {
  readonly from: HookRequestOrigin;
};

const SET_BY_SPOTLIGHT =
  /^(webhook-|spotlight-|authorization$|content-type$|host$)/i;

export const SET_BY_SPOTLIGHT_REASON =
  'is a header Spotlight sets itself on every request, to sign it and say where it came from';

export const isSetBySpotlight = (header: string): boolean =>
  SET_BY_SPOTLIGHT.test(header);

const SHORTEST_TIMEOUT = 1;

const LONGEST_TIMEOUT = 30;

const at = (...segments: (string | number)[]) => FieldPath.of(segments);

const sendsInTheClear = (url: URL, fromNetwork: boolean): boolean =>
  url.protocol !== 'https:' && !fromNetwork;

const uniqueNames = (tools: readonly ToolName[]): ToolName[] =>
  tools.filter(
    (tool, index) => tools.findIndex((each) => each.equals(tool)) === index,
  );

const guardStep = (step: HookStep, index: number): void => {
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

  if (step.kind === 'request') {
    const signed = step.headers.find(isSetBySpotlight);

    if (signed !== undefined) {
      throw new InvalidHookError(
        at('steps', index, 'request', 'headers', signed),
        SET_BY_SPOTLIGHT_REASON,
      );
    }
  }
};

const guardSteps = (fields: HookFields): void => {
  if (fields.steps.length === 0) {
    throw new InvalidHookError(at('steps'), 'must not be empty');
  }

  const seen = new Set<string>();

  fields.steps.forEach((step, index) => {
    guardStep(step, index);

    if (seen.has(step.name.value)) {
      throw new InvalidHookError(
        at('steps', index, 'name'),
        `repeats the name ${step.name.value}`,
      );
    }

    seen.add(step.name.value);
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
    if (!fields.match.isFor(fields.event)) {
      throw new InvalidHookError(
        at('match'),
        `is written for another event than ${fields.event.name}`,
      );
    }

    guardSteps(fields);
    guardFailure(fields);

    return new Hook({
      ...fields,
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

  get match(): HookMatch {
    return this.fields.match;
  }

  matches(task: MatchedTask, event: HookEventFacts): boolean {
    return this.fields.match.matches(task, event);
  }

  startFailure(
    step: HookStepName,
    at: {
      readonly deadline: Date;
      readonly now: Date;
      readonly resuming: boolean;
    },
  ): HookFailure | null {
    if (!this.fields.steps.some((each) => each.name.equals(step))) {
      return HookFailure.noLongerAStep();
    }

    return !at.resuming && at.now.getTime() >= at.deadline.getTime()
      ? HookFailure.notStartedWithin(this.fields.timeoutSeconds)
      : null;
  }

  deadlineFrom(now: Date, budget: Date | null): Date {
    const own = now.getTime() + this.fields.timeoutSeconds * 1000;

    return new Date(Math.min(own, budget?.getTime() ?? own));
  }

  get requestsFromNetwork(): boolean {
    return this.fields.steps.some(
      (step) => step.kind === 'request' && step.fromNetwork,
    );
  }

  callDenial(
    named: ToolName,
    provided: ProvidedTool | null,
    actsAs: ActsAs | null,
  ): HookFailure | null {
    if (provided === null || actsAs === null || !provided.tool.equals(named)) {
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

    if (actsAs.byRequester) {
      return HookFailure.of(
        'not-allowed',
        `names ${named.value}, which acts as the person who started a task. A hook acts as nobody`,
      );
    }

    return null;
  }

  requestDenial(step: HookStepName, url: URL): HookFailure | null {
    const fromNetwork = this.fields.steps.some(
      (each) =>
        each.name.equals(step) && each.kind === 'request' && each.fromNetwork,
    );

    return sendsInTheClear(url, fromNetwork)
      ? HookFailure.of(
          'not-allowed',
          `sends to ${url.origin}, which is not https`,
        )
      : null;
  }

  decisionOn(step: HookStepName, ended: StepEnded): HookDecision | null {
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
          `Hook ${hook} failed at step ${step.value} and blocks on failure. Reason: ${ended.failedBecause}`,
        )
      : HookDecision.allowed();
  }
}
