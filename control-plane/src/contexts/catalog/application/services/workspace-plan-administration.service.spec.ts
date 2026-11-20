import { WorkspacePlanAdministration } from '@catalog/application/services/workspace-plan-administration.service';
import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanChanged } from '@catalog/domain/events/workspace-plan-changed.event';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = PlanTerm.of(Plan.team, new Date('2027-01-01T00:00:00.000Z'));

const ENTERPRISE = PlanTerm.of(Plan.enterprise);

const administering = (current: PlanTerm | null = null) => {
  const added: WorkspacePlan[] = [];
  const saved: WorkspacePlan[] = [];
  const plans: WorkspacePlanRepository = {
    find: async () =>
      current
        ? WorkspacePlan.rehydrate({
            workspaceId: WORKSPACE,
            term: current,
            version: 2,
          })
        : null,
    add: async (plan) => void added.push(plan),
    save: async (plan) => void saved.push(plan),
  };

  return {
    administration: new WorkspacePlanAdministration(plans),
    added,
    saved,
  };
};

const changeOf = (plan: WorkspacePlan | undefined) =>
  (plan?.pullEvents() as readonly WorkspacePlanChanged[] | undefined)?.[0];

describe('WorkspacePlanAdministration', () => {
  it('assigns a plan to a workspace that has none, as Spotlight', async () => {
    const { administration, added, saved } = administering();

    await administration.set(WORKSPACE, TEAM);

    expect(saved).toEqual([]);
    expect(added.map((each) => each.term)).toEqual([TEAM]);
    expect(changeOf(added[0])?.change.by.actor).toBeNull();
  });

  it('changes the plan a workspace has', async () => {
    const { administration, added, saved } = administering(TEAM);

    await administration.set(WORKSPACE, ENTERPRISE);

    expect(added).toEqual([]);
    expect(saved.map((each) => [each.term, each.version])).toEqual([
      [ENTERPRISE, 2],
    ]);
  });

  it('stores nothing for the free plan with no end on a workspace that has no plan', async () => {
    const { administration, added, saved } = administering();

    await administration.set(WORKSPACE, PlanTerm.free);

    expect(added).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('removes the plan when it is set to the free plan with no end', async () => {
    const { administration, saved } = administering(TEAM);

    await administration.set(WORKSPACE, PlanTerm.free);

    expect(saved.map((each) => each.isRemoved)).toEqual([true]);
  });

  it('removes the plan of a workspace, as Spotlight', async () => {
    const { administration, saved } = administering(TEAM);

    await administration.remove(WORKSPACE);

    expect(saved.map((each) => each.isRemoved)).toEqual([true]);
    expect(changeOf(saved[0])).toMatchObject({
      term: PlanTerm.free,
      previous: TEAM,
      change: { by: { actor: null } },
    });
  });

  it('has nothing to remove from a workspace with no plan', async () => {
    const { administration, added, saved } = administering();

    await administration.remove(WORKSPACE);

    expect(added).toEqual([]);
    expect(saved).toEqual([]);
  });
});
