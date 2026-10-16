import type {
  LineResponseDto,
  MemberResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
import {
  EXPERIMENTS_ID,
  GROWTH_ID,
  GROWTH_LINES,
  GROWTH_RUNS,
  GROWTH_TASKS,
} from '@/mocks/world/growth';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';
import {
  DELIVERY_ID,
  INCIDENTS_ID,
  PLATFORM_ID,
  PLATFORM_LINES,
  PLATFORM_RUNS,
  PLATFORM_TASKS,
} from '@/mocks/world/platform';

export { DELIVERY_ID, EXPERIMENTS_ID, GROWTH_ID, INCIDENTS_ID, PLATFORM_ID };

export const SLUG = 'acme';

export const WORKSPACE: WorkspaceResponseDto = {
  id: 'workspace_acme',
  name: 'Acme',
  slug: SLUG,
  role: 'owner',
  teams: [
    { id: PLATFORM_ID, name: 'Platform' },
    { id: GROWTH_ID, name: 'Growth' },
  ],
  provisioning: 'done',
};

export type WorldKind = 'full' | 'empty';

export type World = {
  readonly kind: WorldKind;
  readonly workspace: WorkspaceResponseDto;
  readonly lines: Record<string, LineResponseDto[]>;
  readonly members: Record<string, MemberResponseDto[]>;
  tasks: Record<string, TaskResponseDto[]>;
  runs: Record<string, TaskRunResponseDto[]>;
};

const MEMBERS: Record<string, MemberResponseDto[]> = {
  [PLATFORM_ID]: [
    { ...SAM, role: 'owner', mayBeSetTo: [] },
    { ...MAYA, role: 'member', mayBeSetTo: ['admin'] },
    { ...TOM, role: 'member', mayBeSetTo: ['admin'] },
  ],
  [GROWTH_ID]: [
    { ...SAM, role: 'owner', mayBeSetTo: [] },
    { ...PRIYA, role: 'admin', mayBeSetTo: ['member'] },
  ],
};

const createWorld = (kind: WorldKind): World => ({
  kind,
  workspace: WORKSPACE,
  lines: { [PLATFORM_ID]: PLATFORM_LINES, [GROWTH_ID]: GROWTH_LINES },
  members: structuredClone(MEMBERS),
  tasks:
    kind === 'empty'
      ? { [PLATFORM_ID]: [], [GROWTH_ID]: [] }
      : {
          [PLATFORM_ID]: structuredClone(PLATFORM_TASKS),
          [GROWTH_ID]: structuredClone(GROWTH_TASKS),
        },
  runs:
    kind === 'empty'
      ? {}
      : structuredClone({ ...PLATFORM_RUNS, ...GROWTH_RUNS }),
});

let current = createWorld('full');

const resets: Array<(kind: WorldKind) => void> = [];

export const world = (): World => current;

export const resetWorld = (kind: WorldKind): void => {
  current = createWorld(kind);
  for (const reset of resets) {
    reset(kind);
  }
};

export const perWorld = <T>(make: (kind: WorldKind) => T): (() => T) => {
  let value = make(current.kind);
  resets.push((kind) => {
    value = make(kind);
  });

  return () => value;
};

export const teamOfTask = (taskId: string): string | undefined =>
  Object.entries(current.tasks).find(([, tasks]) =>
    tasks.some((task) => task.id === taskId),
  )?.[0];

export const taskOfRun = (runId: string): string | undefined =>
  Object.entries(current.runs).find(([, runs]) =>
    runs.some((run) => run.id === runId),
  )?.[0];
