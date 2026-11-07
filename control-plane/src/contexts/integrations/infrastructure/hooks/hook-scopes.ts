import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import {
  type CelField,
  HOOK_EVENT_CEL_FIELDS,
} from '@integrations/infrastructure/hooks/hook-event-record';
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

const AT: SchemaFields = { at: 'string' };

const eventSchemaOf = (on: HookEventName): SchemaFields => ({
  ...AT,
  ...Object.fromEntries(
    Object.entries(
      HOOK_EVENT_CEL_FIELDS[on] as Readonly<Record<string, CelField>>,
    ).map(([field, { cel, as }]) => [as ?? field, cel]),
  ),
});

const STEP_SEEN: SchemaFields = { status: 'string', output: OUTSIDE };

export const firingScope = (on: HookEventName): Scope => {
  const event = HookEvent.of(on);
  const declared: Record<string, Declared> = {
    event: { schema: eventSchemaOf(on) },
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
