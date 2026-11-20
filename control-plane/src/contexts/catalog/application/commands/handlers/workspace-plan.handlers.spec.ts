import { RemoveWorkspacePlanHandler } from '@catalog/application/commands/handlers/remove-workspace-plan.handler';
import { SetWorkspacePlanHandler } from '@catalog/application/commands/handlers/set-workspace-plan.handler';
import {
  RemoveWorkspacePlanCommand,
  SetWorkspacePlanCommand,
} from '@catalog/application/commands/workspace-plan.commands';
import type {
  WorkspaceListing,
  WorkspacesPort,
} from '@catalog/application/ports/workspaces.port';
import type { WorkspacePlanAdministration } from '@catalog/application/services/workspace-plan-administration.service';
import { InvalidPlanError } from '@catalog/domain/exceptions/invalid-plan.error';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ACME: WorkspaceListing = {
  id: WorkspaceId.of('ws_1'),
  slug: 'acme',
  name: 'Acme',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  memberCount: 3,
};

const END = new Date('2027-01-01T00:00:00.000Z');

const handling = (found: WorkspaceListing | null = ACME) => {
  const workspaces: WorkspacesPort = {
    list: vi.fn(),
    find: vi.fn().mockResolvedValue(found),
  };
  const administration = {
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as WorkspacePlanAdministration;

  return {
    set: new SetWorkspacePlanHandler(workspaces, administration),
    remove: new RemoveWorkspacePlanHandler(workspaces, administration),
    administration,
  };
};

describe('SetWorkspacePlanHandler', () => {
  it('sets the plan and its end, and answers with them', async () => {
    const { set, administration } = handling();

    await expect(
      set.execute(new SetWorkspacePlanCommand('ws_1', 'team', END)),
    ).resolves.toEqual({ plan: 'team', expiresAt: '2027-01-01T00:00:00.000Z' });
    expect(administration.set).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      PlanTerm.of(Plan.team, END),
    );
  });

  it('finds no workspace that does not exist', async () => {
    const { set, administration } = handling(null);

    await expect(
      set.execute(new SetWorkspacePlanCommand('ws_gone', 'team', null)),
    ).resolves.toBeNull();
    expect(administration.set).not.toHaveBeenCalled();
  });

  it('refuses a plan that does not exist as invalid', async () => {
    const { set, administration } = handling();
    const refused: unknown = await set
      .execute(new SetWorkspacePlanCommand('ws_1', 'gold', null))
      .catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(TranslatedDomainError);
    expect((refused as TranslatedDomainError).refusal).toBeInstanceOf(
      InvalidPlanError,
    );
    expect(administration.set).not.toHaveBeenCalled();
  });
});

describe('RemoveWorkspacePlanHandler', () => {
  it('puts the workspace back on the free plan', async () => {
    const { remove, administration } = handling();

    await expect(
      remove.execute(new RemoveWorkspacePlanCommand('ws_1')),
    ).resolves.toBe(true);
    expect(administration.remove).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('finds no workspace that does not exist', async () => {
    const { remove, administration } = handling(null);

    await expect(
      remove.execute(new RemoveWorkspacePlanCommand('ws_gone')),
    ).resolves.toBe(false);
    expect(administration.remove).not.toHaveBeenCalled();
  });
});
