import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import {
  actorFor,
  attributedIn,
} from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import { CreateLineHandler } from '@work/application/commands/handlers/create-line.handler';
import { DeleteLineHandler } from '@work/application/commands/handlers/delete-line.handler';
import { UpdateLineHandler } from '@work/application/commands/handlers/update-line.handler';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { LineAlreadyOpenedError } from '@work/domain/exceptions/line-already-opened.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineMovedOnError } from '@work/domain/exceptions/line-moved-on.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { LineCompiler } from '@work/infrastructure/lines/line.compile';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  stations: [
    { key: 'backlog', name: 'Backlog', kind: 'backlog', passesTo: ['build'] },
    { key: 'build', name: 'Build', prompt: 'Build it.', ends: true },
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
};

const standingAt = (version: number): Line => {
  let next = 0;
  const opened = Line.open({
    by: attributedIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });

  return Line.rehydrate({
    id: opened.id,
    workspaceId: opened.workspaceId,
    teamId: opened.teamId,
    key: opened.key,
    name: opened.name,
    stations: opened.stations,
    reactions: opened.reactions,
    version,
  });
};

const access = (administers = true) => teamAccess(TEAM, administers);

const teams = {
  find: vi.fn(async () => ({
    id: TEAM,
    workspaceId: WorkspaceId.of('ws_1'),
    key: 'core',
    name: 'Core',
    members: [],
  })),
  inWorkspace: vi.fn(async () => []),
} satisfies TeamDirectoryPort;

const transaction: TransactionPort = { run: (work) => work() };

const NEEDS_TEAM = (id: string) =>
  `${id} needs the Team plan, and this workspace is on the Free plan`;

const catalog = new StationCatalog({
  givenTo: async (_workspace, named) => ({
    tools: [],
    skills: named.skills
      .filter((each) => each.startsWith('catalog.research@'))
      .map((id) => ({
        id,
        description: 'Research on the web.',
        files: [],
        tools: ['catalog.web-search@1.1.0'],
      })),
    refused: [
      ...named.tools.filter((each) => each.startsWith('catalog.web-search@')),
      ...(named.skills.some((each) => each.startsWith('catalog.research@'))
        ? ['catalog.web-search@1.1.0']
        : []),
    ].map((id) => ({
      id,
      reason: 'not-entitled' as const,
      because: NEEDS_TEAM(id),
    })),
  }),
  call: async () => {
    throw new Error('not called here');
  },
});

const giving = (tools: string[], skills: string[] = []) => ({
  ...DELIVERY,
  stations: DELIVERY.stations.map((each, at) =>
    at === 1 ? { ...each, tools, skills } : each,
  ),
});

const creates = () =>
  ({
    claim: vi.fn(async () => ({ kind: 'fresh' as const })),
    created: vi.fn(async () => {}),
  }) satisfies IdempotentCreatesPort;

const lines = (standing: Line | null, thenAt: Line | null = standing) => {
  const find = vi.fn(async () => standing);

  return {
    find,
    save: vi.fn(async (saved: Line) => {
      if (saved.isRetired && !thenAt) {
        return;
      }
      find.mockResolvedValue(thenAt);
    }),
  } as unknown as LineRepository & {
    find: typeof find;
    save: ReturnType<typeof vi.fn>;
  };
};

describe('CreateLineHandler', () => {
  const creating = (over: { administers?: boolean; refusing?: Error } = {}) => {
    const open = vi.fn(async () => {
      if (over.refusing) {
        throw over.refusing;
      }

      return standingAt(0);
    });
    const handler = new CreateLineHandler(
      access(over.administers),
      teams,
      new LineCompiler(),
      { open } as unknown as ApplyLines,
      creates(),
      transaction,
      catalog,
    );

    return {
      create: (definition: unknown) =>
        handler.execute(
          new CreateLineCommand(
            TEAM.value,
            actorFor('user_1'),
            'key-1',
            definition,
          ),
        ),
      open,
    };
  };

  it('opens the line its definition compiles to', async () => {
    const { create, open } = creating();

    expect(await create(DELIVERY)).toMatchObject({ outcome: 'created' });
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'core' }),
      expect.objectContaining({ key: LineKey.of('delivery') }),
      attributedIn('ws_1', actorFor('user_1')),
    );
  });

  it('says what is wrong with a definition, and opens nothing', async () => {
    const { create, open } = creating();
    const refused = await create({ ...DELIVERY, stations: [] });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['stations']);
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a catalog item the workspace’s plan does not include, pointing at where the station names it', async () => {
    const { create, open } = creating();
    const refused = await create(
      giving(['pull-request', 'catalog.web-search@1.1.0']),
    );

    expect(refused).toEqual({
      outcome: 'invalid',
      problems: [
        expect.objectContaining({
          reason: NEEDS_TEAM('catalog.web-search@1.1.0'),
        }),
      ],
    });
    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['stations.1.tools.1']);
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a catalog skill at the skill, where a tool it brings is not included', async () => {
    const refused = await creating().create(
      giving([], ['catalog.research@1.0.0']),
    );

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => [dottedOf(each.field), each.reason]),
    ).toEqual([
      ['stations.1.skills.0', NEEDS_TEAM('catalog.web-search@1.1.0')],
    ]);
  });

  it('says a key the team already has is taken', async () => {
    expect(
      await creating({
        refusing: new LineAlreadyOpenedError('delivery'),
      }).create(DELIVERY),
    ).toEqual({ outcome: 'taken', address: 'core/delivery' });
  });

  it('points at the role when another line already claims it', async () => {
    const refused = await creating({
      refusing: new LineRoleTakenError({
        line: LineKey.of('delivery'),
        role: LineRole.IMPROVEMENT,
        others: [LineKey.of('factory')],
      }),
    }).create(DELIVERY);

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['role']);
  });

  it('forbids someone on the team who does not administer it', async () => {
    expect(await creating({ administers: false }).create(DELIVERY)).toEqual(
      forbiddenTo('configure'),
    );
  });
});

describe('UpdateLineHandler', () => {
  const updating = (
    over: { administers?: boolean; refusing?: Error; thenAt?: Line } = {},
  ) => {
    const kept = lines(standingAt(3));
    const reconcile = vi.fn(async (line: Line) => {
      if (over.refusing) {
        kept.find.mockResolvedValue(over.thenAt ?? line);
        throw over.refusing;
      }

      return line;
    });
    const handler = new UpdateLineHandler(
      access(over.administers),
      new LineCompiler(),
      kept,
      { reconcile } as unknown as ApplyLines,
      transaction,
      catalog,
    );

    return {
      update: (definition: unknown, version = 3) =>
        handler.execute(
          new UpdateLineCommand(
            'line_1',
            actorFor('user_1'),
            version,
            definition,
          ),
        ),
      reconcile,
    };
  };

  it('reconciles the version it was asked to with its definition', async () => {
    const { update, reconcile } = updating();

    expect(await update(DELIVERY)).toEqual({
      outcome: 'updated',
      id: 'line_1',
    });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('names the current version to a change made against another', async () => {
    const { update, reconcile } = updating();

    expect(await update(DELIVERY, 2)).toEqual({
      outcome: 'moved-on',
      currentVersion: 3,
    });
    expect(reconcile).not.toHaveBeenCalled();
    expect(
      await updating({
        refusing: new LineMovedOnError('line_1'),
        thenAt: standingAt(4),
      }).update(DELIVERY),
    ).toEqual({ outcome: 'moved-on', currentVersion: 4 });
  });

  it('refuses a change to a catalog item the plan does not include, and reconciles nothing', async () => {
    const { update, reconcile } = updating();

    expect(await update(giving(['catalog.web-search@1.1.0']))).toMatchObject({
      outcome: 'invalid',
    });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('refuses a change that would strand work, as the line being in use', async () => {
    expect(
      await updating({
        refusing: new LineInUseError('delivery', [
          { key: 'build', name: 'Build', tasks: 2 },
        ]),
      }).update(DELIVERY),
    ).toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining('Build (2 standing there)'),
    });
  });

  it('forbids someone on the team who does not administer it', async () => {
    expect(await updating({ administers: false }).update(DELIVERY)).toEqual(
      forbiddenTo('configure'),
    );
  });
});

describe('DeleteLineHandler', () => {
  const deleting = (tasks: Record<string, number> = {}) => {
    const standing = standingAt(3);
    const kept = lines(standing, null);
    const tallies = {
      standingAt: vi.fn(),
      lockedStandingAt: vi.fn(
        async () =>
          new Map(
            standing.stations.map((each) => [
              each.id.value,
              tasks[each.key.value] ?? 0,
            ]),
          ),
      ),
    } satisfies StationTalliesPort;
    const handler = new DeleteLineHandler(access(), kept, tallies, transaction);

    return {
      remove: (version = 3) =>
        handler.execute(
          new DeleteLineCommand('line_1', actorFor('user_1'), version),
        ),
      kept,
      standing,
    };
  };

  it('retires a line no task stands on', async () => {
    const { remove, kept } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((kept.save.mock.calls[0] as [Line])[0].isRetired).toBe(true);
  });

  it('will not retire a line while a task stands on it', async () => {
    const { remove, kept, standing } = deleting();
    const [, working] = standing.stations;
    const busy = deleting({ [working?.key.value ?? '']: 1 });

    expect(await busy.remove()).toMatchObject({ outcome: 'in-use' });
    expect(busy.kept.save).not.toHaveBeenCalled();
    expect(kept.save).not.toHaveBeenCalled();
    expect(await remove(2)).toEqual({ outcome: 'moved-on', currentVersion: 3 });
  });
});
