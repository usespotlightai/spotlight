import { ASSIST_EVENT_MAPPERS } from '@assist/application/integration-events/assist.event-mappers';
import { AssistSession } from '@assist/domain/aggregates/assist-session.aggregate';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    ASSIST_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
      (each) => each.map(event, new Date()),
    ),
  );

const ordered = AssistSession.order({
  id: AssistSessionId.of('assist_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  purpose: AssistPurpose.of('insights.judge'),
  key: AssistSessionKey.of('judging:run_1:1'),
  basedOn: RunId.of('run_1'),
  run: RunId.of('run_2'),
  resultSchema: { type: 'object' },
  briefing: 'Judge the run.',
  files: {},
  at: new Date(0),
});

describe('ASSIST_EVENT_MAPPERS', () => {
  it('publishes nothing of an order: assist queues its run itself', () => {
    expect(published(ordered.pullEvents())).toEqual([]);
  });

  it('publishes a settled session with its workspace, purpose, key and outcome', () => {
    const failed = ordered.failed('no-harness', new Date(1));

    expect(published(failed.pullEvents())).toEqual([
      {
        kind: 'assist.session-settled.v1',
        workspaceId: 'ws_1',
        purpose: 'insights.judge',
        key: 'judging:run_1:1',
        outcome: 'failed',
      },
    ]);
  });
});
