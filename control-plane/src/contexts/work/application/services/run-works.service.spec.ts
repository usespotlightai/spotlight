import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import {
  aChatDispatch,
  aTaskDispatch,
  dispatchesOf,
} from '@work/application/services/run-works.fake-spec';
import { RunWorks } from '@work/application/services/run-works.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { trialOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');
const BUILD = StationId.of('station_build');
const NOW = new Date('2026-11-07T09:00:00.000Z');

const SCREENSHOT = Attachment.rehydrate({
  id: 'att_1',
  name: 'queue.png',
  contentType: 'image/png',
  size: 10,
});

const message = (position: number, body: string, files: Attachment[] = []) => ({
  position: { value: position },
  body: { value: body },
  toldOn: () => ({ value: body }),
  attachments: files,
});

const aTrial = (): Dispatch =>
  Dispatch.trialOrdered({
    order: trialOrderOf(RUN),
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: null,
    subject: {
      kind: 'trial',
      basedOn: RunId.of('run_0'),
      taskId: TASK,
      stationId: BUILD,
      asOf: NOW,
      repositories: [{ path: 'api', repository: Repository.of('acme/api') }],
      followUp: null,
    },
    configuredAs: StationConfig.rehydrate(
      {
        prompt: null,
        harness: 'dev',
        model: null,
        effort: null,
        profile: null,
        image: null,
        repositories: [],
        skills: [],
        tools: [],
        decisions: false,
        memories: false,
      },
      'f'.repeat(64),
    ),
    now: NOW,
  });

const works = (over: {
  leased?: boolean;
  dispatches?: DispatchRepository;
  task?: Partial<Task> | null;
  chat?: Partial<Chat> | null;
}) =>
  new RunWorks(
    {
      leasedBy: async () =>
        over.leased === false
          ? null
          : ({
              runId: RUN,
              workspaceId: WorkspaceId.of('ws_1'),
              policy: { actsBeyondItself: true },
            } as unknown as LeasedRunFacts),
    } as unknown as RunLeasesPort,
    {} as RunsPort,
    { find: async () => over.task ?? null } as unknown as TaskRepository,
    { find: async () => over.chat ?? null } as unknown as ChatRepository,
    {
      findByStation: async () => null,
    } as unknown as LineMapsPort,
    over.dispatches ?? dispatchesOf(),
    { now: () => NOW, sleep: async () => {} },
  );

describe('RunWorks, handing a runner the messages sent to its run', () => {
  it('hands over what was said on the task while the task holds the run', async () => {
    const pending = await works({
      dispatches: dispatchesOf(aTaskDispatch(RUN, TASK, BUILD)),
      task: {
        pendingFor: () =>
          [message(2, 'Use the staging queue.', [SCREENSHOT])] as never,
      },
    }).pendingFor('run_1', 'runner_1');

    expect(pending).toEqual([
      {
        position: 2,
        body: 'Use the staging queue.',
        attachments: [SCREENSHOT],
      },
    ]);
  });

  it('hands over nothing once the task let go of the run', async () => {
    expect(
      await works({
        dispatches: dispatchesOf(aTaskDispatch(RUN, TASK, BUILD)),
        task: {
          pendingFor: () => [],
        },
      }).pendingFor('run_1', 'runner_1'),
    ).toEqual([]);
  });

  it('hands over what was said in the chat', async () => {
    expect(
      await works({
        dispatches: dispatchesOf(aChatDispatch(RUN, ChatId.of('chat_1'))),
        chat: {
          pendingFor: () => [message(1, 'And the retries?')] as never,
        },
      }).pendingFor('run_1', 'runner_1'),
    ).toEqual([{ position: 1, body: 'And the retries?', attachments: [] }]);
  });

  it('hands nothing to a run that works no task or chat', async () => {
    expect(await works({}).pendingFor('run_1', 'runner_1')).toEqual([]);
  });

  it('answers nothing to a runner that does not lease the run', async () => {
    expect(
      await works({ leased: false }).pendingFor('run_1', 'runner_2'),
    ).toBeNull();
  });
});

describe('RunWorks, finding the repository a run’s change is checked in', () => {
  it('finds a trial’s repository from the checkouts it tries, even once its station is gone', async () => {
    const checked = works({ dispatches: dispatchesOf(aTrial()) });

    expect(await checked.repositoryForCheck(RUN, 'api')).toEqual({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: expect.objectContaining({ value: 'acme/api' }),
    });
    expect(await checked.repositoryForCheck(RUN, 'web')).toBeNull();
  });

  it('finds nothing for a chat or for a run there is no dispatch of', async () => {
    expect(
      await works({
        dispatches: dispatchesOf(aChatDispatch(RUN, ChatId.of('chat_1'))),
      }).repositoryForCheck(RUN, 'api'),
    ).toBeNull();
    expect(await works({}).repositoryForCheck(RUN, 'api')).toBeNull();
  });
});
