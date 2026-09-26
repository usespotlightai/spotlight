import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import {
  type Declared,
  type SchemaFields,
  Scope,
} from '@platform/expressions/scope';

const OUTSIDE = 'dyn';

const TASK: Declared = {
  schema: {
    id: 'string',
    title: 'string',
    url: 'string',
    line: 'string',
    station: 'string',
    stationKey: 'string',
    marks: 'map<string, string>',
    repositories: 'list<string>',
    pullRequest: OUTSIDE,
  },
};

const RUN: Declared = { schema: { id: 'string' } };

const HOOK: Declared = { schema: { key: 'string', address: 'string' } };

const CHANGED = 'list<string>';

const AT: SchemaFields = { at: 'string' };

const EVENT_FIELDS: Readonly<Record<HookEventName, SchemaFields>> = {
  'tool.using': { ...AT, tool: 'string', inputs: 'map<string, dyn>' },
  'tool.used': {
    ...AT,
    tool: 'string',
    inputs: 'map<string, dyn>',
    output: OUTSIDE,
    failed: 'bool',
  },
  'run.starting': AT,
  'run.ended': { ...AT, outcome: 'string' },
  'handover.giving': { ...AT, to: OUTSIDE, note: 'string' },
  'pull-request.opening': {
    ...AT,
    repository: 'string',
    branch: 'string',
    title: 'string',
    changed: CHANGED,
  },
  'pull-request.merged': {
    ...AT,
    url: 'string',
    repository: 'string',
    mergeCommit: 'string',
    changed: CHANGED,
  },
  'task.opened': AT,
  'task.moved': { ...AT, from: 'string', to: 'string' },
};

const STEP_SEEN: SchemaFields = { status: 'string', output: OUTSIDE };

export const firingScope = (on: HookEventName): Scope => {
  const event = HookEvent.of(on);
  const declared: Record<string, Declared> = {
    event: { schema: EVENT_FIELDS[on] },
    task: TASK,
    vars: 'map<string, string>',
    hook: HOOK,
  };

  if (event.inRun) {
    declared.run = RUN;
  }

  return Scope.of(declared);
};

export const steppingScope = (
  on: HookEventName,
  earlier: readonly string[],
): Scope =>
  firingScope(on).and({
    step: {
      schema: Object.fromEntries(earlier.map((name) => [name, STEP_SEEN])),
    },
  });

export const ANY_EVENT = Scope.of({
  event: OUTSIDE,
  task: TASK,
  run: RUN,
  vars: 'map<string, string>',
  hook: HOOK,
});

export const ANY_STEP = ANY_EVENT.and({ step: 'map<string, dyn>' });
