import { CATALOG_EVENT_MAPPERS } from '@catalog/application/integration-events/catalog.event-mappers';
import { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { changed } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  CATALOG_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, new Date()),
  );

const WORKSPACE = WorkspaceId.of('ws_1');

const CHANGE = changed('workspace-plan', 'ws_1', 'acme');

const ENDS = new Date('2027-01-01T00:00:00.000Z');

describe('CATALOG_EVENT_MAPPERS', () => {
  it('publishes a new workspace plan with its end', () => {
    expect(
      published(
        new WorkspacePlanCreated(
          WORKSPACE,
          PlanTerm.of(Plan.team, ENDS),
          CHANGE,
        ),
      ),
    ).toEqual([
      {
        kind: 'catalog.workspace-plan-created.v1',
        workspaceId: 'ws_1',
        plan: 'team',
        expiresAt: '2027-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('publishes the new term of an updated workspace plan, and not the one before', () => {
    expect(
      published(
        new WorkspacePlanUpdated(
          WORKSPACE,
          PlanTerm.of(Plan.enterprise),
          PlanTerm.of(Plan.team, ENDS),
          CHANGE,
        ),
      ),
    ).toEqual([
      {
        kind: 'catalog.workspace-plan-updated.v1',
        workspaceId: 'ws_1',
        plan: 'enterprise',
        expiresAt: null,
      },
    ]);
  });

  it('publishes a deleted workspace plan by its workspace', () => {
    expect(
      published(
        new WorkspacePlanDeleted(WORKSPACE, PlanTerm.of(Plan.team), CHANGE),
      ),
    ).toEqual([
      { kind: 'catalog.workspace-plan-deleted.v1', workspaceId: 'ws_1' },
    ]);
  });
});
