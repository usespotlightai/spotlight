import { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import { recordOfEvent } from '@integrations/infrastructure/hooks/hook-event-record';
import { firingScope } from '@integrations/infrastructure/hooks/hook-scopes';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const tool = Tool.of('github.comment');
const repository = Repository.of('acme/api');

const EVERY_EVENT: readonly HookEventFacts[] = [
  HookEventFacts.of({ on: 'tool.using', tool, inputs: {} }),
  HookEventFacts.of({
    on: 'tool.used',
    tool,
    inputs: {},
    output: null,
    failed: false,
  }),
  HookEventFacts.of({ on: 'run.starting' }),
  HookEventFacts.of({ on: 'run.ended', outcome: 'handed-over' }),
  HookEventFacts.of({ on: 'handover.submitting', to: null, note: 'done' }),
  HookEventFacts.of({
    on: 'pull-request.opening',
    repository,
    branch: 'feat/x',
    title: 'Add x',
    changed: ['a.ts'],
  }),
  HookEventFacts.of({
    on: 'pull-request.merged',
    pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/1'),
    repository,
    mergeCommit: 'abc123',
    changed: ['a.ts'],
  }),
  HookEventFacts.of({ on: 'task.opened' }),
  HookEventFacts.of({ on: 'task.moved', from: 'Build', to: 'Review' }),
];

describe('firingScope', () => {
  it.each(EVERY_EVENT.map((facts) => [facts.on, facts] as const))(
    'declares exactly the event fields a %s hook sees',
    (on, facts) => {
      expect(firingScope(on).fieldsAt(['event'])).toEqual(
        [...Object.keys(recordOfEvent(facts)), 'at'].sort(),
      );
    },
  );
});
