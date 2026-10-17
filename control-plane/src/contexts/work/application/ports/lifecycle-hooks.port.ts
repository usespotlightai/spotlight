import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';

export const LIFECYCLE_HOOKS = Symbol('LIFECYCLE_HOOKS');

export type BeforeMoment =
  | {
      readonly on: 'tool.using';
      readonly tool: string;
      readonly inputs: Readonly<Record<string, unknown>>;
    }
  | { readonly on: 'run.starting' }
  | {
      readonly on: 'handover.submitting';
      readonly to: string | null;
      readonly note: string;
    }
  | {
      readonly on: 'pull-request.opening';
      readonly repository: string;
      readonly branch: string;
      readonly title: string;
      readonly changed: readonly string[];
    };

export interface ToolUsedMoment {
  readonly on: 'tool.used';
  readonly tool: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly output: unknown;
  readonly failed: boolean;
}

export type HookVerdict =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'denied'; readonly reason: string };

export interface LifecycleHooksPort {
  listens(teamId: string, on: BeforeMoment['on']): Promise<boolean>;

  before(
    task: HookedTaskDto,
    moment: BeforeMoment,
    until?: Date,
  ): Promise<HookVerdict>;

  after(
    task: HookedTaskDto,
    moment: ToolUsedMoment,
    occurrence: string,
  ): Promise<void>;
}
