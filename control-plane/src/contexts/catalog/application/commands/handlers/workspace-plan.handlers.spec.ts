import { DeleteWorkspacePlanHandler } from '@catalog/application/commands/handlers/delete-workspace-plan.handler';
import { SetWorkspacePlanHandler } from '@catalog/application/commands/handlers/set-workspace-plan.handler';
import {
  DeleteWorkspacePlanCommand,
  SetWorkspacePlanCommand,
} from '@catalog/application/commands/workspace-plan.commands';
import type {
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@catalog/application/ports/workspace-directory.port';
import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import { InvalidPlanError } from '@catalog/domain/exceptions/invalid-plan.error';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const ACME: DirectoryWorkspace = {
  id: WORKSPACE,
  slug: 'acme',
  name: 'Acme',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  memberCount: 3,
};

const END = new Date('2027-01-01T00:00:00.000Z');

const TEAM = PlanTerm.of(Plan.team, END);

const handling = (
  options: { found?: DirectoryWorkspace | null; current?: PlanTerm } = {},
) => {
  const added: WorkspacePlan[] = [];
  const saved: WorkspacePlan[] = [];
  const directory: WorkspaceDirectoryPort = {
    list: vi.fn(),
    find: vi
      .fn()
      .mockResolvedValue(options.found === undefined ? ACME : options.found),
  };
  const plans: WorkspacePlanRepository = {
    find: async () =>
      options.current
        ? WorkspacePlan.rehydrate({
            workspaceId: WORKSPACE,
            term: options.current,
            version: 2,
          })
        : null,
    add: async (plan) => void added.push(plan),
    save: async (plan) => void saved.push(plan),
  };

  return {
    set: new SetWorkspacePlanHandler(directory, plans),
    delete: new DeleteWorkspacePlanHandler(directory, plans),
    added,
    saved,
  };
};

const actorsOf = (plans: readonly WorkspacePlan[]) =>
  plans.flatMap((each) =>
    (each.pullEvents() as ConfigurationChanged[]).map(
      (event) => event.change.by.actor,
    ),
  );

describe('SetWorkspacePlanHandler', () => {
  it('creates the plan of a workspace without one, as Spotlight, and answers with it', async () => {
    const { set, added, saved } = handling();

    await expect(
      set.execute(new SetWorkspacePlanCommand('ws_1', 'team', END)),
    ).resolves.toEqual({ plan: 'team', expiresAt: '2027-01-01T00:00:00.000Z' });
    expect(saved).toEqual([]);
    expect(added.map((each) => each.term)).toEqual([TEAM]);
    expect(actorsOf(added)).toEqual([null]);
  });

  it('saves the change to a stored plan', async () => {
    const { set, added, saved } = handling({ current: TEAM });

    await set.execute(new SetWorkspacePlanCommand('ws_1', 'enterprise', null));

    expect(added).toEqual([]);
    expect(saved.map((each) => [each.term.plan, each.version])).toEqual([
      [Plan.enterprise, 2],
    ]);
  });

  it('stores nothing when nothing changes', async () => {
    const free = handling();
    const same = handling({ current: TEAM });

    await free.set.execute(new SetWorkspacePlanCommand('ws_1', 'free', END));
    await same.set.execute(new SetWorkspacePlanCommand('ws_1', 'team', END));

    expect([free.added, free.saved, same.added, same.saved]).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });

  it('finds no workspace that does not exist', async () => {
    const { set, added } = handling({ found: null });

    await expect(
      set.execute(new SetWorkspacePlanCommand('ws_gone', 'team', null)),
    ).resolves.toBeNull();
    expect(added).toEqual([]);
  });

  it('refuses a plan that does not exist as invalid', async () => {
    const { set, added } = handling();
    const refused: unknown = await set
      .execute(new SetWorkspacePlanCommand('ws_1', 'gold', null))
      .catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(TranslatedDomainError);
    expect((refused as TranslatedDomainError).refusal).toBeInstanceOf(
      InvalidPlanError,
    );
    expect(added).toEqual([]);
  });
});

describe('DeleteWorkspacePlanHandler', () => {
  it('deletes the stored plan, as Spotlight', async () => {
    const handled = handling({ current: TEAM });

    await expect(
      handled.delete.execute(new DeleteWorkspacePlanCommand('ws_1')),
    ).resolves.toBe(true);
    expect(handled.saved.map((each) => each.isDeleted)).toEqual([true]);
    expect(actorsOf(handled.saved)).toEqual([null]);
  });

  it('has nothing to delete from a workspace without a stored plan', async () => {
    const handled = handling();

    await expect(
      handled.delete.execute(new DeleteWorkspacePlanCommand('ws_1')),
    ).resolves.toBe(true);
    expect(handled.saved).toEqual([]);
  });

  it('finds no workspace that does not exist', async () => {
    const handled = handling({ found: null, current: TEAM });

    await expect(
      handled.delete.execute(new DeleteWorkspacePlanCommand('ws_gone')),
    ).resolves.toBe(false);
    expect(handled.saved).toEqual([]);
  });
});
