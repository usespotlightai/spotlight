import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanChanged } from '@catalog/domain/events/workspace-plan-changed.event';
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

const changesOf = (plan: WorkspacePlan) =>
  plan.pullEvents() as readonly WorkspacePlanChanged[];

describe('WorkspacePlan', () => {
  it('says the plan changed from free when it is assigned', () => {
    const assigned = WorkspacePlan.assign({
      workspaceId: WORKSPACE,
      term: TEAM,
      by: BY,
    });
    const [changed, ...more] = changesOf(assigned);

    expect(assigned.version).toBe(0);
    expect(assigned.term).toBe(TEAM);
    expect(more).toEqual([]);
    expect(changed).toMatchObject({
      kind: 'workspace-plan.changed',
      workspaceId: WORKSPACE,
      term: TEAM,
      previous: PlanTerm.free,
    });
  });

  it('records the change as a configuration change of the workspace, made by Spotlight', () => {
    const [changed] = changesOf(stored().changeTo(ENTERPRISE, BY));

    expect(changesConfiguration(changed)).toBe(true);
    expect(changed.change).toMatchObject({
      resource: 'workspace-plan',
      resourceId: 'ws_1',
      key: 'plan',
      action: 'updated',
      by: { actor: null, workspaceId: WORKSPACE },
    });
    expect(changed.change.recordedDetail).toEqual({
      plan: 'enterprise',
      expiresAt: null,
    });
    expect(changed.previous).toBe(TEAM);
  });

  it('records the end of the plan it changes to', () => {
    const [changed] = changesOf(stored(ENTERPRISE).changeTo(TEAM, BY));

    expect(changed.change.recordedDetail).toEqual({
      plan: 'team',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
  });

  it('keeps its version, which the repository raises when it stores the change', () => {
    expect(stored(TEAM, 3).changeTo(ENTERPRISE, BY).version).toBe(3);
  });

  it('changes nothing for the term it already has', () => {
    const plan = stored();
    const same = plan.changeTo(PlanTerm.of(Plan.team, new Date(END)), BY);

    expect(same).toBe(plan);
    expect(same.hasEvents).toBe(false);
  });

  it('is removed when it changes to the free plan with no end', () => {
    const removed = stored().changeTo(PlanTerm.free, BY);
    const [changed] = changesOf(removed);

    expect(removed.isRemoved).toBe(true);
    expect(removed.term).toBe(PlanTerm.free);
    expect(changed).toMatchObject({ term: PlanTerm.free, previous: TEAM });
    expect(changed.change.recordedDetail).toEqual({
      plan: 'free',
      expiresAt: null,
    });
  });

  it('keeps the free plan with an end, which expires to the same plan', () => {
    const freeUntil = PlanTerm.of(Plan.free, END);
    const changed = stored().changeTo(freeUntil, BY);

    expect(changed.isRemoved).toBe(false);
    expect(changed.term).toBe(freeUntil);
  });

  it('says the workspace is back on the free plan when it is removed', () => {
    const removed = stored().remove(BY);

    expect(removed.isRemoved).toBe(true);
    expect(changesOf(removed)).toMatchObject([
      { term: PlanTerm.free, previous: TEAM },
    ]);
  });

  it('is removed without a change when it already holds the free plan with no end', () => {
    const removed = stored(PlanTerm.free).remove(BY);

    expect(removed.isRemoved).toBe(true);
    expect(removed.hasEvents).toBe(false);
  });

  it('keeps the events of each step', () => {
    const plan = WorkspacePlan.assign({
      workspaceId: WORKSPACE,
      term: TEAM,
      by: BY,
    })
      .changeTo(ENTERPRISE, BY)
      .remove(BY);

    expect(changesOf(plan).map((each) => each.term)).toEqual([
      TEAM,
      ENTERPRISE,
      PlanTerm.free,
    ]);
  });

  it('cannot change after it is removed', () => {
    const removed = stored().remove(BY);

    expect(() => removed.changeTo(ENTERPRISE, BY)).toThrow(
      InconsistentStateError,
    );
    expect(() => removed.remove(BY)).toThrow(InconsistentStateError);
  });

  it('refuses a stored version that is impossible', () => {
    expect(() => stored(TEAM, -1)).toThrow(InconsistentStateError);
    expect(() => stored(TEAM, 1.5)).toThrow(InconsistentStateError);
  });
});
