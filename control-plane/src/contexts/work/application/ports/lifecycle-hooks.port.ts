import type { TaskViewDto } from '@work/application/ports/task-views.port';

export const LIFECYCLE_HOOKS = Symbol('LIFECYCLE_HOOKS');

export type BeforeHookEvent =
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

export interface ToolUsedHookEvent {
  readonly on: 'tool.used';
  readonly tool: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly output: unknown;
  readonly failed: boolean;
}

export type HookDecision =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'denied'; readonly reason: string };

export interface LifecycleHooksPort {
  listens(teamId: string, on: BeforeHookEvent['on']): Promise<boolean>;

  before(
    task: TaskViewDto,
    event: BeforeHookEvent,
    until?: Date,
  ): Promise<HookDecision>;

  after(
    task: TaskViewDto,
    event: ToolUsedHookEvent,
    occurrence: string,
  ): Promise<void>;
}
