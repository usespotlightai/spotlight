import { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import { CreateSkillHandler } from '@configuration/application/commands/handlers/create-skill.handler';
import { DeleteSkillHandler } from '@configuration/application/commands/handlers/delete-skill.handler';
import { UpdateSkillHandler } from '@configuration/application/commands/handlers/update-skill.handler';
import { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import type { SkillsGiven } from '@configuration/application/services/skills-given.service';
import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillAlreadyDefinedError } from '@configuration/domain/exceptions/skill-already-defined.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import { FORBIDDEN } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const GRAFANA = {
  key: 'grafana',
  files: {
    'SKILL.md':
      '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch first.',
  },
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

const standingAt = (version: number) =>
  SkillDefinition.rehydrate({
    id: SkillDefinitionId.of('skill_1'),
    teamId: TEAM,
    key: SkillKey.of('grafana'),
    files: SkillFiles.of(GRAFANA.files),
    version,
  });

const definitions = (
  over: { standing?: SkillDefinition | null; refusing?: Error } = {},
) => {
  const read = vi.fn(async () => over.standing ?? null);

  return {
    withId: read,
    of: read,
    ofTeam: vi.fn(async () => []),
    save: vi.fn(async (_: SkillDefinition) => {
      if (over.refusing) {
        throw over.refusing;
      }
    }),
  } satisfies SkillDefinitionRepository;
};

describe('CreateSkillHandler', () => {
  const creating = (over: { administers?: boolean; refusing?: Error } = {}) => {
    const kept = definitions({ refusing: over.refusing });
    const handler = new CreateSkillHandler(
      access(over.administers),
      teams,
      new SkillCompiler(),
      kept,
      {
        claim: vi.fn(async () => ({ kind: 'fresh' as const })),
        created: vi.fn(async () => {}),
      } satisfies IdempotentCreatesPort,
      { generate: () => 'skill_new' },
      transaction,
    );

    return {
      create: (definition: unknown) =>
        handler.execute(
          new CreateSkillCommand(
            TEAM.value,
            actorFor('user_1'),
            'key-1',
            definition,
          ),
        ),
      kept,
    };
  };

  it('defines the skill its files describe', async () => {
    const { create, kept } = creating();

    expect(await create(GRAFANA)).toEqual({
      outcome: 'created',
      id: 'skill_new',
      replayed: false,
    });
    expect((kept.save.mock.calls[0] as [SkillDefinition])[0].key.value).toBe(
      'grafana',
    );
  });

  it('says a key the team already has is taken', async () => {
    expect(
      await creating({
        refusing: new SkillAlreadyDefinedError('grafana'),
      }).create(GRAFANA),
    ).toEqual({ outcome: 'taken', address: 'core/grafana' });
  });

  it('says what is wrong, and defines nothing', async () => {
    const { create, kept } = creating();
    const refused = await create({ key: 'grafana', files: {} });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['files']);
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('forbids someone on the team who does not administer it', async () => {
    expect(await creating({ administers: false }).create(GRAFANA)).toEqual(
      FORBIDDEN,
    );
  });
});

describe('UpdateSkillHandler', () => {
  const updating = () => {
    const kept = definitions({ standing: standingAt(3) });
    const handler = new UpdateSkillHandler(
      access(),
      new SkillCompiler(),
      kept,
      transaction,
    );

    return {
      update: (definition: unknown, version = 3) =>
        handler.execute(
          new UpdateSkillCommand(
            'skill_1',
            actorFor('user_1'),
            version,
            definition,
          ),
        ),
      kept,
    };
  };

  it('replaces the skill’s files', async () => {
    const { update, kept } = updating();
    const files = { ...GRAFANA.files, 'notes.md': 'More.' };

    expect(await update({ ...GRAFANA, files })).toEqual({
      outcome: 'updated',
      id: 'skill_1',
    });
    expect(
      (kept.save.mock.calls[0] as [SkillDefinition])[0].files.fields,
    ).toEqual(files);
  });

  it('points at the key when asked to change it', async () => {
    const refused = await updating().update({
      key: 'loki',
      files: {
        'SKILL.md':
          '---\nname: loki\ndescription: Read logs\n---\nSearch first.',
      },
    });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['key']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(GRAFANA, 2)).toEqual({
      outcome: 'moved-on',
      currentVersion: 3,
    });
  });
});

describe('DeleteSkillHandler', () => {
  const deleting = (given = SkillUses.none()) => {
    const kept = definitions({ standing: standingAt(3) });
    const handler = new DeleteSkillHandler(
      access(),
      kept,
      { onTeam: vi.fn(async () => given) } as unknown as SkillsGiven,
      transaction,
    );

    return {
      remove: () =>
        handler.execute(
          new DeleteSkillCommand('skill_1', actorFor('user_1'), 3),
        ),
      kept,
    };
  };

  it('retires a skill no station gives', async () => {
    const { remove, kept } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((kept.save.mock.calls[0] as [SkillDefinition])[0].isRetired).toBe(
      true,
    );
  });

  it('will not retire a skill a station gives', async () => {
    const { remove, kept } = deleting(
      SkillUses.of([{ skill: 'grafana', by: 'delivery/implementation' }]),
    );

    expect(await remove()).toMatchObject({ outcome: 'in-use' });
    expect(kept.save).not.toHaveBeenCalled();
  });
});
