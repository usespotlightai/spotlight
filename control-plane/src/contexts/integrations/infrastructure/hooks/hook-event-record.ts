import {
  HookEventFacts,
  type HookEventFields,
} from '@integrations/domain/value-objects/hook-event-facts.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export type HookEventRecord = Readonly<Record<string, unknown>>;

export type CelField = { readonly cel: string; readonly as?: string };

type FieldsOf<E extends HookEventName> = Omit<
  Extract<HookEventFields, { on: E }>,
  'on'
>;

const OUTSIDE = 'dyn';

const TEXT: CelField = { cel: 'string' };

const INPUTS: CelField = { cel: 'map<string, dyn>' };

const PATHS: CelField = { cel: 'list<string>' };

export const HOOK_EVENT_CEL_FIELDS: {
  readonly [E in HookEventName]: {
    readonly [K in keyof FieldsOf<E>]-?: CelField;
  };
} = {
  'tool.using': { tool: TEXT, inputs: INPUTS },
  'tool.used': {
    tool: TEXT,
    inputs: INPUTS,
    output: { cel: OUTSIDE },
    failed: { cel: 'bool' },
  },
  'run.starting': {},
  'run.ended': { outcome: TEXT },
  'handover.submitting': { to: { cel: OUTSIDE }, note: TEXT },
  'pull-request.opening': {
    repository: TEXT,
    branch: TEXT,
    title: TEXT,
    changed: PATHS,
  },
  'pull-request.merged': {
    pullRequest: { cel: 'string', as: 'url' },
    repository: TEXT,
    mergeCommit: TEXT,
    changed: PATHS,
  },
  'task.opened': {},
  'task.moved': { from: TEXT, to: TEXT },
};

export const recordOfEvent = (facts: HookEventFacts): HookEventRecord => {
  const { fields } = facts;

  switch (fields.on) {
    case 'tool.using':
      return { tool: fields.tool.value, inputs: fields.inputs };
    case 'tool.used':
      return {
        tool: fields.tool.value,
        inputs: fields.inputs,
        output: fields.output,
        failed: fields.failed,
      };
    case 'run.starting':
    case 'task.opened':
      return {};
    case 'run.ended':
      return { outcome: fields.outcome };
    case 'handover.submitting':
      return { to: fields.to, note: fields.note };
    case 'pull-request.opening':
      return {
        repository: fields.repository.value,
        branch: fields.branch,
        title: fields.title,
        changed: [...fields.changed],
      };
    case 'pull-request.merged':
      return {
        url: fields.pullRequest.value,
        repository: fields.repository.value,
        mergeCommit: fields.mergeCommit,
        ...(fields.changed === null ? {} : { changed: [...fields.changed] }),
      };
    case 'task.moved':
      return { from: fields.from, to: fields.to };
  }
};

const unreadable = (on: HookEventName, field: string): never => {
  throw new InconsistentStateError(
    'hook event',
    `of ${on} has no readable ${field}`,
  );
};

const textAt = (record: HookEventRecord, on: HookEventName, field: string) => {
  const value = record[field];

  return typeof value === 'string' ? value : unreadable(on, field);
};

const textsAt = (record: HookEventRecord, on: HookEventName, field: string) => {
  const value = record[field];

  return Array.isArray(value) && value.every((each) => typeof each === 'string')
    ? value
    : unreadable(on, field);
};

const inputsAt = (record: HookEventRecord, on: HookEventName) => {
  const value = record.inputs;

  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : unreadable(on, 'inputs');
};

const readable = <T>(read: () => T, on: HookEventName, field: string): T => {
  try {
    return read();
  } catch {
    return unreadable(on, field);
  }
};

export const eventOfRecord = (
  on: HookEventName,
  record: HookEventRecord,
): HookEventFacts => {
  switch (on) {
    case 'tool.using':
      return HookEventFacts.of({
        on,
        tool: readable(() => Tool.of(textAt(record, on, 'tool')), on, 'tool'),
        inputs: inputsAt(record, on),
      });
    case 'tool.used':
      return HookEventFacts.of({
        on,
        tool: readable(() => Tool.of(textAt(record, on, 'tool')), on, 'tool'),
        inputs: inputsAt(record, on),
        output: record.output ?? null,
        failed:
          typeof record.failed === 'boolean'
            ? record.failed
            : unreadable(on, 'failed'),
      });
    case 'run.starting':
    case 'task.opened':
      return HookEventFacts.of({ on });
    case 'run.ended':
      return HookEventFacts.of({ on, outcome: textAt(record, on, 'outcome') });
    case 'handover.submitting':
      return HookEventFacts.of({
        on,
        to: record.to === null ? null : textAt(record, on, 'to'),
        note: textAt(record, on, 'note'),
      });
    case 'pull-request.opening':
      return HookEventFacts.of({
        on,
        repository: readable(
          () => Repository.of(textAt(record, on, 'repository')),
          on,
          'repository',
        ),
        branch: textAt(record, on, 'branch'),
        title: textAt(record, on, 'title'),
        changed: textsAt(record, on, 'changed'),
      });
    case 'pull-request.merged':
      return HookEventFacts.of({
        on,
        pullRequest: readable(
          () => PullRequestUrl.of(textAt(record, on, 'url')),
          on,
          'url',
        ),
        repository: readable(
          () => Repository.of(textAt(record, on, 'repository')),
          on,
          'repository',
        ),
        mergeCommit: textAt(record, on, 'mergeCommit'),
        changed:
          record.changed === undefined ? null : textsAt(record, on, 'changed'),
      });
    case 'task.moved':
      return HookEventFacts.of({
        on,
        from: textAt(record, on, 'from'),
        to: textAt(record, on, 'to'),
      });
  }
};
