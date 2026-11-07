import { InvalidHookFiringTransitionError } from '@integrations/domain/exceptions/invalid-hook-firing-transition.error';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { deepFrozen } from '@shared-kernel/domain/deep-frozen';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

type Inputs = Readonly<Record<string, unknown>>;

export type HookEventFields =
  | {
      readonly on: 'tool.using';
      readonly tool: Tool;
      readonly inputs: Inputs;
    }
  | {
      readonly on: 'tool.used';
      readonly tool: Tool;
      readonly inputs: Inputs;
      readonly output: unknown;
      readonly failed: boolean;
    }
  | { readonly on: 'run.starting' }
  | { readonly on: 'run.ended'; readonly outcome: string }
  | {
      readonly on: 'handover.submitting';
      readonly to: string | null;
      readonly note: string;
    }
  | {
      readonly on: 'pull-request.opening';
      readonly repository: Repository;
      readonly branch: string;
      readonly title: string;
      readonly changed: readonly string[];
    }
  | {
      readonly on: 'pull-request.merged';
      readonly pullRequest: PullRequestUrl;
      readonly repository: Repository;
      readonly mergeCommit: string;
      readonly changed: readonly string[] | null;
    }
  | { readonly on: 'task.opened' }
  | { readonly on: 'task.moved'; readonly from: string; readonly to: string };

export type ToolUsedFields = Extract<HookEventFields, { on: 'tool.used' }>;

const frozen = (fields: HookEventFields): HookEventFields => {
  if ('inputs' in fields) {
    return {
      ...fields,
      inputs: deepFrozen(structuredClone(fields.inputs)),
      ...('output' in fields
        ? { output: deepFrozen(structuredClone(fields.output)) }
        : {}),
    };
  }

  if ('changed' in fields && fields.changed !== null) {
    return { ...fields, changed: Object.freeze([...fields.changed]) };
  }

  return { ...fields };
};

export class HookEventFacts {
  private constructor(readonly fields: HookEventFields) {}

  static of(fields: HookEventFields): HookEventFacts {
    return new HookEventFacts(frozen(fields));
  }

  get on(): HookEventName {
    return this.fields.on;
  }

  get tool(): Tool | null {
    return 'tool' in this.fields ? this.fields.tool : null;
  }

  get repository(): Repository | null {
    return 'repository' in this.fields ? this.fields.repository : null;
  }

  get pullRequest(): PullRequestUrl | null {
    return 'pullRequest' in this.fields ? this.fields.pullRequest : null;
  }

  get changed(): readonly string[] | null {
    return 'changed' in this.fields ? this.fields.changed : null;
  }

  withChanges(changed: readonly string[]): HookEventFacts {
    if (this.fields.on !== 'pull-request.merged') {
      throw new InvalidHookFiringTransitionError(
        `cannot learn changed paths of a ${this.fields.on} event`,
      );
    }

    return HookEventFacts.of({ ...this.fields, changed });
  }
}
