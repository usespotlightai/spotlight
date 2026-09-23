import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DefineLineCommand } from '@work/application/commands/define-line.command';
import { DefineLineHandler } from '@work/application/commands/handlers/define-line.handler';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { openLine } from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { LineCompiler } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it, vi } from 'vitest';

const TEAM = 'team_1';

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  stations: [
    { key: 'backlog', name: 'Backlog', kind: 'backlog', passesTo: ['build'] },
    {
      key: 'build',
      name: 'Build',
      prompt: 'Build it.',
      ends: true,
    },
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
};

const defining = (
  over: {
    administers?: boolean;
    problems?: readonly ConfigurationProblem[];
  } = {},
) => {
  let next = 0;
  const apply = vi.fn(async (_: TeamId, plans: readonly LinePlan[]) =>
    over.problems
      ? { lines: [], problems: over.problems }
      : {
          lines: plans.map((plan) =>
            openLine({
              identity: {
                id: LineId.of('line_1'),
                workspaceId: WorkspaceId.of('ws_1'),
                teamId: TeamId.of(TEAM),
              },
              plan,
              newId: () => `id_${++next}`,
            }),
          ),
          problems: [],
        },
  );

  const handler = new DefineLineHandler(
    {
      onTeam: vi.fn(async () => ({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of(TEAM),
        slug: 'acme',
        viewer: UserId.of('user_1'),
        administers: over.administers ?? true,
      })),
    } as unknown as WorkspaceAccessPort,
    new LineCompiler(),
    { apply } as unknown as ApplyLines,
  );

  return {
    define: (definition: unknown) =>
      handler.execute(new DefineLineCommand(TEAM, 'user_1', definition)),
    apply,
  };
};

describe('DefineLineHandler', () => {
  it('applies the line its definition compiles to, carrying the definition', async () => {
    const { define, apply } = defining();

    const defined = await define(DELIVERY);
    const [, [plan]] = apply.mock.calls[0] as [TeamId, LinePlan[]];

    expect(plan?.key.value).toBe('delivery');
    expect(plan?.definition?.fields).toMatchObject({ key: 'delivery' });
    expect(defined).toMatchObject({
      ok: true,
      line: { id: 'line_1', definition: { key: 'delivery' } },
    });
  });

  it('says what is wrong with a definition, and applies nothing', async () => {
    const { define, apply } = defining();

    const defined = await define({ ...DELIVERY, stations: [] });

    expect(defined).toMatchObject({
      ok: false,
      problems: [
        { path: 'lines/delivery', field: FieldPath.dotted('stations') },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('says why a line could not be applied', async () => {
    const stranded = ConfigurationProblem.of({
      path: 'lines/delivery',
      at: 'stations',
      reason: 'would remove Build (2 standing there)',
    });
    const { define } = defining({ problems: [stranded] });

    expect(await define(DELIVERY)).toEqual({
      ok: false,
      problems: [stranded],
    });
  });

  it('defines nothing for someone who does not administer the team', async () => {
    const { define, apply } = defining({ administers: false });

    expect(await define(DELIVERY)).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
