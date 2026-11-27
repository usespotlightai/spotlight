import type { PublicChangeStackDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { RepositoryVisibilityPort } from '@change-review/application/ports/repository-visibility.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { PublicWorkAccess } from '@change-review/application/services/public-work-access.service';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TASK = { kind: 'task', taskId: TaskId.of('task_1') } as const;
const RUN = { kind: 'run', runId: RunId.of('run_1') } as const;

const stackIn = (repository: string): PublicChangeStackDto => ({
  id: `stack-${repository}`,
  repository,
  state: 'ready',
  files: [],
  cohorts: [],
  removed: [],
});

const setup = (
  over: {
    stacks?: string[];
    visible?: (repository: string) => boolean;
    known?: boolean;
  } = {},
) => {
  const stacks = (over.stacks ?? ['acme/api']).map(stackIn);
  const visible = over.visible ?? (() => true);
  const work = partial<WorkPort>({
    task: vi.fn(async () =>
      over.known === false
        ? null
        : partial<ReviewedTask>({ workspaceId: WORKSPACE }),
    ),
    run: vi.fn(async () =>
      over.known === false
        ? null
        : partial<RunForReview>({ workspaceId: WORKSPACE }),
    ),
  });
  const reader = partial<ChangeStackReaderPort>({
    publicOfTask: vi.fn(async () => stacks),
    publicOfRun: vi.fn(async () => stacks),
  });
  const visibility: RepositoryVisibilityPort = {
    arePublic: vi.fn(
      async (_: WorkspaceId, repositories: readonly Repository[]) =>
        repositories.length > 0 &&
        repositories.every((each) => visible(each.value)),
    ),
  };
  const telemetry = telemetryInMemory();

  return {
    access: new PublicWorkAccess(work, reader, visibility, telemetry),
    stacks,
    visibility,
    telemetry,
  };
};

describe('PublicWorkAccess', () => {
  it.each([
    ['task', TASK],
    ['run', RUN],
  ] as const)(
    'serves the stacks of a %s when every repository is public',
    async (_, visibility) => {
      const { access, stacks, telemetry } = setup({
        stacks: ['acme/api', 'acme/web'],
      });

      expect(await access.stacksOf(visibility)).toEqual(stacks);
      expect(telemetry.counted).toEqual([
        {
          metric: 'spotlight.public_stack.reads',
          attributes: { 'spotlight.public_stack.outcome': 'served' },
        },
      ]);
    },
  );

  it('asks about the workspace the work belongs to', async () => {
    const { access, visibility } = setup({ stacks: ['acme/api'] });

    await access.stacksOf(TASK);

    expect(visibility.arePublic).toHaveBeenCalledWith(WORKSPACE, [
      expect.objectContaining({ owner: 'acme', name: 'api' }),
    ]);
  });

  it('denies when one repository of the stacks is private', async () => {
    const { access, telemetry } = setup({
      stacks: ['acme/api', 'acme/secret'],
      visible: (repository) => repository !== 'acme/secret',
    });

    expect(await access.stacksOf(TASK)).toBeNull();
    expect(telemetry.counted[0]?.attributes).toEqual({
      'spotlight.public_stack.outcome': 'denied',
    });
  });

  it('denies when the visibility of a repository is unknown', async () => {
    const { access } = setup({ visible: () => false });

    expect(await access.stacksOf(RUN)).toBeNull();
  });

  it('denies a stack whose repository name is not valid', async () => {
    const { access } = setup({ stacks: ['not a repository'] });

    expect(await access.stacksOf(TASK)).toBeNull();
  });

  it('denies work without stacks', async () => {
    const { access } = setup({ stacks: [] });

    expect(await access.stacksOf(TASK)).toBeNull();
  });

  it('denies work that does not exist, without reading stacks', async () => {
    const { access, visibility } = setup({ known: false });

    expect(await access.stacksOf(RUN)).toBeNull();
    expect(visibility.arePublic).not.toHaveBeenCalled();
  });

  it('asks again on every request, so a repository that turned private is denied at once', async () => {
    let isPublic = true;
    const { access } = setup({ visible: () => isPublic });

    expect(await access.stacksOf(TASK)).not.toBeNull();

    isPublic = false;

    expect(await access.stacksOf(TASK)).toBeNull();
  });
});
