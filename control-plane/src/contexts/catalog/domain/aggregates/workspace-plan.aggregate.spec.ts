import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import type { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import type { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import { ExpiredPlanTermError } from '@catalog/domain/exceptions/expired-plan-term.error';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const BY = ChangeActor.spotlight(WORKSPACE);

const END = new Date('2027-01-01T00:00:00.000Z');

const TEAM = PlanTerm.of(Plan.team, END);

const ENTERPRISE = PlanTerm.of(Plan.enterprise);

const stored = (term: PlanTerm = TEAM, version = 3) =>
  WorkspacePlan.rehydrate({ workspaceId: WORKSPACE, term, version });

const NOW = new Date('2026-11-21T00:00:00.000Z');

const create = (term: PlanTerm) =>
  WorkspacePlan.create({ workspaceId: WORKSPACE, term, by: BY, now: NOW });

const eventsOf = <E>(plan: WorkspacePlan | null) =>
  (plan?.pullEvents() ?? []) as readonly E[];

describe('WorkspacePlan', () => {
  describe('create', () => {
    it('creates the plan, and records it as a created configuration change by the actor', () => {
      const created = create(TEAM);
      const [event, ...more] = eventsOf<WorkspacePlanCreated>(created);

      expect(created).toMatchObject({ term: TEAM, version: 0 });
      expect(more).toEqual([]);
      expect(event).toMatchObject({
        kind: 'workspace-plan.created',
        workspaceId: WORKSPACE,
        term: TEAM,
      });
      expect(changesConfiguration(event)).toBe(true);
      expect(event.change).toMatchObject({
        resource: 'workspace-plan',
        resourceId: 'ws_1',
        key: 'plan',
        action: 'created',
        by: BY,
      });
      expect(event.change.recordedDetail).toEqual({
        plan: 'team',
        expiresAt: '2027-01-01T00:00:00.000Z',
      });
    });

    it('stores nothing for the free plan, which a workspace has without a stored plan', () => {
      expect(create(PlanTerm.free)).toBeNull();
      expect(create(PlanTerm.of(Plan.free, END))).toBeNull();
    });

    it('refuses a plan whose end is not in the future', () => {
      expect(() => create(PlanTerm.of(Plan.team, NOW))).toThrow(
        ExpiredPlanTermError,
      );
    });
  });

  describe('set', () => {
    it('updates the plan, and records what it was', () => {
      const updated = stored().set(ENTERPRISE, BY, NOW);
      const [event] = eventsOf<WorkspacePlanUpdated>(updated);

      expect(updated).toMatchObject({
        term: ENTERPRISE,
        version: 3,
        isDeleted: false,
      });
      expect(event).toMatchObject({
        kind: 'workspace-plan.updated',
        term: ENTERPRISE,
        previous: TEAM,
      });
      expect(event.change.action).toBe('updated');
      expect(event.change.recordedDetail).toEqual({
        plan: 'enterprise',
        expiresAt: null,
      });
    });

    it('changes nothing for the term it already has', () => {
      expect(
        stored().set(PlanTerm.of(Plan.team, new Date(END)), BY, NOW),
      ).toBeNull();
    });

    it('deletes the plan when it is set to the free plan', () => {
      const deleted = stored().set(PlanTerm.of(Plan.free, END), BY, NOW);
      const [event] = eventsOf<WorkspacePlanDeleted>(deleted);

      expect(deleted?.isDeleted).toBe(true);
      expect(event).toMatchObject({
        kind: 'workspace-plan.deleted',
        previous: TEAM,
      });
      expect(event.change.action).toBe('deleted');
    });

    it('refuses a plan whose end is not in the future', () => {
      expect(() =>
        stored().set(
          PlanTerm.of(Plan.enterprise, new Date('2026-01-01T00:00:00Z')),
          BY,
          NOW,
        ),
      ).toThrow(ExpiredPlanTermError);
    });

    it('keeps a stored plan that has expired until it is set again', () => {
      const expired = PlanTerm.of(Plan.team, new Date('2026-01-01T00:00:00Z'));

      expect(stored(expired).set(expired, BY, NOW)).toBeNull();
      expect(stored(expired).delete(BY).isDeleted).toBe(true);
    });
  });

  it('deletes a stored plan, and records it as a deleted configuration change', () => {
    const deleted = stored().delete(BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.version).toBe(3);
    expect(eventsOf<WorkspacePlanDeleted>(deleted)).toMatchObject([
      {
        kind: 'workspace-plan.deleted',
        workspaceId: WORKSPACE,
        previous: TEAM,
        change: { action: 'deleted', by: BY },
      },
    ]);
  });

  it('keeps the events of each step', () => {
    const created = create(TEAM) as WorkspacePlan;
    const updated = created.set(ENTERPRISE, BY, NOW) as WorkspacePlan;

    expect(
      updated
        .delete(BY)
        .pullEvents()
        .map((each) => each.kind),
    ).toEqual([
      'workspace-plan.created',
      'workspace-plan.updated',
      'workspace-plan.deleted',
    ]);
  });

  it('cannot change after it is deleted', () => {
    const deleted = stored().delete(BY);

    expect(() => deleted.set(ENTERPRISE, BY, NOW)).toThrow(
      InconsistentStateError,
    );
    expect(() => deleted.delete(BY)).toThrow(InconsistentStateError);
  });

  it('refuses a stored plan that holds the free plan', () => {
    expect(() => stored(PlanTerm.free)).toThrow('holds the free plan');
  });

  it('refuses a stored version that is impossible', () => {
    expect(() => stored(TEAM, -1)).toThrow(InconsistentStateError);
    expect(() => stored(TEAM, 1.5)).toThrow(InconsistentStateError);
  });
});
