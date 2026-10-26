import { CreateWorkspaceWithTeamCommand } from '@identity/application/commands/create-workspace-with-team.command';
import { CreateWorkspaceWithTeamHandler } from '@identity/application/commands/handlers/create-workspace-with-team.handler';
import type { SignupSurveysPort } from '@identity/application/ports/signup-surveys.port';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

const transaction: TransactionPort = { inTransaction: (work) => work() };

let added: Workspace | undefined;
let enqueued: DomainEvent[];
let repository: WorkspaceRepository;
let recorded: {
  workspaceId: string;
  respondent: string;
  survey: SignupSurvey;
}[];
let surveys: SignupSurveysPort;

const ENGINEER = { jobFunction: 'engineering', referralSource: 'Hacker News' };

const handle = (
  name = 'Acme Inc.',
  slug = 'acme-inc',
  teamName = 'Platform',
  survey: { jobFunction: string; referralSource: string | null } = ENGINEER,
) =>
  new CreateWorkspaceWithTeamHandler(
    repository,
    surveys,
    ids(),
    transaction,
  ).execute(
    new CreateWorkspaceWithTeamCommand(
      name,
      slug,
      teamName,
      survey,
      actorFor('user_1'),
    ),
  );

beforeEach(() => {
  added = undefined;
  enqueued = [];
  repository = {
    isTaken: vi.fn().mockResolvedValue(false),
    add: vi.fn(async (workspace: Workspace) => {
      added = workspace;
      enqueued.push(...workspace.pullEvents());
    }),
    find: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
  recorded = [];
  surveys = {
    record: vi.fn(async (workspaceId, respondent, survey) => {
      recorded.push({
        workspaceId: workspaceId.value,
        respondent: respondent.value,
        survey,
      });
    }),
  };
});

describe('CreateWorkspaceWithTeamHandler', () => {
  it('returns the workspace it created, first team included', async () => {
    await expect(handle()).resolves.toEqual({
      id: 'id_1',
      name: 'Acme Inc.',
      slug: 'acme-inc',
      teams: [{ id: 'id_2', name: 'Platform' }],
    });
  });

  it('hands the repository one whole aggregate', async () => {
    await handle();

    expect(added?.members).toEqual([
      { userId: UserId.of('user_1'), role: WorkspaceRole.owner },
    ]);
  });

  it('says the workspace was created, for its first team to follow', async () => {
    await handle();

    expect(
      enqueued.filter((each) => each instanceof WorkspaceCreated),
    ).toHaveLength(1);
  });

  it('enqueues nothing when the write fails', async () => {
    repository.isTaken = vi.fn().mockResolvedValue(true);

    await handle().catch(() => undefined);

    expect(enqueued).toHaveLength(0);
  });

  it('reports a taken slug as a conflict, without writing', async () => {
    repository.isTaken = vi.fn().mockResolvedValue(true);

    const error = await handle().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toMatchObject({ kind: 'conflict' });
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('reports a slug lost to the insert race as a conflict too', async () => {
    repository.add = vi
      .fn()
      .mockRejectedValue(new WorkspaceSlugTakenError('acme-inc'));

    await expect(handle()).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('reports an unusable slug as invalid input', async () => {
    await expect(handle('Acme', 'not a slug')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('records the survey answers of the person who created it', async () => {
    await handle();

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      workspaceId: 'id_1',
      respondent: 'user_1',
    });
    expect(recorded[0]?.survey.jobFunction.value).toBe('engineering');
    expect(recorded[0]?.survey.referralSource).toBe('Hacker News');
  });

  it('records a blank referral source as no answer', async () => {
    await handle(undefined, undefined, undefined, {
      jobFunction: 'founder',
      referralSource: '   ',
    });

    expect(recorded[0]?.survey.referralSource).toBeNull();
  });

  it('reports an unknown job function as invalid input, without writing', async () => {
    await expect(
      handle(undefined, undefined, undefined, {
        jobFunction: 'astronaut',
        referralSource: null,
      }),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(repository.add).not.toHaveBeenCalled();
    expect(surveys.record).not.toHaveBeenCalled();
  });

  it('reports a referral source over 200 characters as invalid input', async () => {
    await expect(
      handle(undefined, undefined, undefined, {
        jobFunction: 'data',
        referralSource: 'a'.repeat(201),
      }),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('reports a blank name as invalid input', async () => {
    await expect(handle('   ')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
