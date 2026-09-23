import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WORK_PUBLICATIONS } from '@work/application/integration-events/work.publications';
import { LineOpened } from '@work/domain/events/line-opened.event';
import { LineRedefined } from '@work/domain/events/line-redefined.event';
import { LineRetired } from '@work/domain/events/line-retired.event';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  WORK_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event),
  );

const IDENTITY = [
  LineId.of('line_1'),
  WorkspaceId.of('ws_1'),
  TeamId.of('team_1'),
  LineKey.of('delivery'),
] as const;

describe('WORK_PUBLICATIONS for lines', () => {
  it.each([
    [new LineOpened(...IDENTITY), 'work.line-opened.v1'],
    [new LineRedefined(...IDENTITY), 'work.line-redefined.v1'],
    [new LineRetired(...IDENTITY), 'work.line-retired.v1'],
  ])('publishes %o as plain data', (event, kind) => {
    expect(published(event)).toEqual([
      {
        kind,
        lineId: 'line_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        key: 'delivery',
      },
    ]);
  });
});
