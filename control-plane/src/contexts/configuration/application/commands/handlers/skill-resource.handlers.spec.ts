import { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import { CreateSkillHandler } from '@configuration/application/commands/handlers/create-skill.handler';
import { DeleteSkillHandler } from '@configuration/application/commands/handlers/delete-skill.handler';
import { UpdateSkillHandler } from '@configuration/application/commands/handlers/update-skill.handler';
import { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import type { StationReferences } from '@configuration/application/services/station-references.service';
import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillAlreadyExistsError } from '@configuration/domain/exceptions/skill-already-exists.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { teamAccess } from '@identity/application/ports/workspace-access.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
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

const transaction: TransactionPort = { inTransaction: (work) => work() };

const storedAt = (version: number) =>
  SkillDefinition.rehydrate({
    id: SkillDefinitionId.of('skill_1'),
    teamId: TEAM,
    key: SkillKey.of('grafana'),
    files: SkillFiles.of(GRAFANA.files),
    version,
  });

const definitions = (
  over: { stored?: SkillDefinition | null; throwing?: Error } = {},
) => {
  const read = vi.fn(async () => over.stored ?? null);

  return {
    withId: read,
    of: read,
    ofTeam: vi.fn(async () => []),
    save: vi.fn(async (_: SkillDefinition) => {
      if (over.throwing) {
        throw over.throwing;
      }
    }),
  } satisfies SkillDefinitionRepository;
};

describe('CreateSkillHandler', () => {
  const creating = (over: { administers?: boolean; throwing?: Error } = {}) => {
    const repository = definitions({ throwing: over.throwing });
    const handler = new CreateSkillHandler(
      access(over.administers),
      teams,
      new SkillCompiler(),
      repository,
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
      repository,
    };
  };

  it('creates the skill its files describe', async () => {
    const { create, repository } = creating();

    expect(await create(GRAFANA)).toEqual({
      outcome: 'created',
      id: 'skill_new',
      replayed: false,
    });
    expect(
      (repository.save.mock.calls[0] as [SkillDefinition])[0].key.value,
    ).toBe('grafana');
  });

  it('says a key the team already has is taken', async () => {
    expect(
      await creating({
        throwing: new SkillAlreadyExistsError('grafana'),
      }).create(GRAFANA),
    ).toEqual({ outcome: 'taken', address: 'core/grafana' });
  });

  it('says what is wrong, and creates nothing', async () => {
    const { create, repository } = creating();
    const rejected = await create({ key: 'grafana', files: {} });

    expect(
      rejected?.outcome === 'invalid' &&
        rejected.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['files']);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('forbids someone on the team who does not administer it', async () => {
    expect(await creating({ administers: false }).create(GRAFANA)).toEqual(
      forbiddenTo('configure'),
    );
  });
});

describe('UpdateSkillHandler', () => {
  const updating = () => {
    const repository = definitions({ stored: storedAt(3) });
    const handler = new UpdateSkillHandler(
      access(),
      new SkillCompiler(),
      repository,
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
      repository,
    };
  };

  it('replaces the skill’s files', async () => {
    const { update, repository } = updating();
    const files = { ...GRAFANA.files, 'notes.md': 'More.' };

    expect(await update({ ...GRAFANA, files })).toEqual({
      outcome: 'updated',
      id: 'skill_1',
    });
    expect(
      (repository.save.mock.calls[0] as [SkillDefinition])[0].files.fields,
    ).toEqual(files);
  });

  it('points at the key when a request changes it', async () => {
    const rejected = await updating().update({
      key: 'loki',
      files: {
        'SKILL.md':
          '---\nname: loki\ndescription: Read logs\n---\nSearch first.',
      },
    });

    expect(
      rejected?.outcome === 'invalid' &&
        rejected.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['key']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(GRAFANA, 2)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 3,
    });
  });
});

describe('DeleteSkillHandler', () => {
  const deleting = (uses = StationUses.none()) => {
    const repository = definitions({ stored: storedAt(3) });
    const handler = new DeleteSkillHandler(
      access(),
      repository,
      { onTeam: vi.fn(async () => uses) } as unknown as StationReferences,
      transaction,
    );

    return {
      remove: () =>
        handler.execute(
          new DeleteSkillCommand('skill_1', actorFor('user_1'), 3),
        ),
      repository,
    };
  };

  it('deletes a skill that no station enables', async () => {
    const { remove, repository } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect(
      (repository.save.mock.calls[0] as [SkillDefinition])[0].isDeleted,
    ).toBe(true);
  });

  it('will not delete a skill that a station enables', async () => {
    const { remove, repository } = deleting(
      StationUses.of([{ name: 'grafana', by: 'delivery/implementation' }]),
    );

    expect(await remove()).toMatchObject({ outcome: 'in-use' });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
