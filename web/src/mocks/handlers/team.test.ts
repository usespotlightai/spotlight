import { describe, expect, it } from 'vitest';
import {
  acceptProposal,
  editMemory,
  listChats,
  listTasks,
  listTeamMemories,
  readChat,
  readChatJournal,
  readTeamMemory,
  remember,
  retireMemory,
  sendChatMessage,
  startChat,
  writeMemory,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { DELIVERY_ID, GROWTH_ID, PLATFORM_ID } from '@/mocks/world';

const team = { teamId: PLATFORM_ID };

const memoryIds = async (query: Record<string, string> = {}) => {
  const { data } = await listTeamMemories({
    path: team,
    query,
    throwOnError: true,
  });
  return data.map((memory) => memory.id);
};

describe('the mock team memories', () => {
  serveMockApi();

  it('lists what each team remembers, active by default', async () => {
    const { data: growth } = await listTeamMemories({
      path: { teamId: GROWTH_ID },
      throwOnError: true,
    });

    expect(await memoryIds()).toEqual(
      expect.arrayContaining([
        'memory_billing',
        'memory_gone',
        'memory_staging',
      ]),
    );
    expect(await memoryIds()).not.toContain('memory_flaky');
    expect(growth.length).toBeGreaterThan(0);
  });

  it('narrows by status, kind, line, station, repository and path', async () => {
    expect(await memoryIds({ status: 'retired' })).toEqual([
      'memory_flaky',
      'memory_branches',
    ]);
    expect(await memoryIds({ kind: 'rationale' })).toEqual(['memory_gone']);
    expect(await memoryIds({ lineId: DELIVERY_ID })).not.toContain(
      'memory_billing',
    );
    expect(await memoryIds({ stationId: 'station_implementation' })).toContain(
      'memory_gone',
    );
    expect(await memoryIds({ repository: 'acme/worker' })).toEqual(
      expect.arrayContaining(['memory_gone', 'memory_staging']),
    );
    expect(await memoryIds({ path: 'src/retries' })).toEqual(['memory_gone']);
  });

  it('opens a memory with the steps or notes it rests on', async () => {
    const { data: gone } = await readTeamMemory({
      path: { ...team, memoryId: 'memory_gone' },
      throwOnError: true,
    });
    const { data: billing } = await readTeamMemory({
      path: { ...team, memoryId: 'memory_billing' },
      throwOnError: true,
    });
    const { data: branches } = await readTeamMemory({
      path: { ...team, memoryId: 'memory_branches' },
      throwOnError: true,
    });

    expect(gone.harness).toBe('claude-code');
    expect(gone.steps.length).toBeGreaterThan(0);
    expect(gone.grounds).toEqual({
      taskId: 'task_retries',
      runId: 'run_retries_2',
    });
    expect(billing.notes[0]?.author?.name).toBe('Maya Chen');
    expect(branches.successor?.id).toBe('memory_branches_ticket');
  });

  it('writes, edits and retires memories', async () => {
    const { data: written } = await writeMemory({
      path: team,
      body: {
        kind: 'environment',
        body: 'Run the worker tests with REDIS_URL pointing at the local container.',
        lineId: DELIVERY_ID,
        repository: 'acme/worker',
      },
      throwOnError: true,
    });
    const { data: edited } = await editMemory({
      path: { ...team, memoryId: 'memory_gone' },
      body: {
        kind: 'rationale',
        body: 'A 410 Gone is permanent: drop the delivery and tell the endpoint owner.',
        lineId: DELIVERY_ID,
        stationId: 'station_implementation',
        repository: 'acme/worker',
        paths: ['src/retries/deliver.ts'],
      },
      throwOnError: true,
    });
    const { data: retired } = await retireMemory({
      path: { ...team, memoryId: 'memory_staging' },
      body: { reason: 'The worker now reloads its limits on deploy.' },
      throwOnError: true,
    });

    expect(written.scope).toBe('line');
    expect(written.source).toBe('person');
    expect(edited.superseded?.id).toBe('memory_gone');
    expect(edited.steps.length).toBeGreaterThan(0);
    expect(retired.retirement?.reason).toBe(
      'The worker now reloads its limits on deploy.',
    );
    expect(await memoryIds()).toEqual(
      expect.arrayContaining([written.id, edited.id]),
    );
    expect(await memoryIds({ status: 'retired' })).toEqual(
      expect.arrayContaining(['memory_gone', 'memory_staging']),
    );
  });

  it('takes a memory an agent requests to remember', async () => {
    const { data } = await remember({
      path: { runId: 'run_retries_3' },
      body: { kind: 'failure', body: 'The consumer test needs Redis running.' },
      throwOnError: true,
    });

    expect(data.origin).toBe('remembered');
    expect(data.state).toBe('proposed');
  });
});

describe('the mock agent chats', () => {
  serveMockApi();

  it('lists the chats and opens one with its journal', async () => {
    const { data: chats } = await listChats({ path: team, throwOnError: true });
    const { data: chat } = await readChat({
      path: { ...team, chatId: 'chat_retries' },
      throwOnError: true,
    });
    const { data: journal } = await readChatJournal({
      path: { ...team, chatId: 'chat_retries' },
      throwOnError: true,
    });

    expect(chats.map((each) => each.id)).toContain('chat_retries');
    expect(chat.title).toBe('Why do retries pile up?');
    expect(chat.messages.some((each) => each.proposal?.state === 'open')).toBe(
      true,
    );
    expect(journal.flatMap((each) => each.steps).at(-1)?.kind).toBe('message');
  });

  it('turns an accepted proposal into a task at its station', async () => {
    await acceptProposal({
      path: { ...team, chatId: 'chat_retries', position: 2 },
      throwOnError: true,
    });
    const { data: chat } = await readChat({
      path: { ...team, chatId: 'chat_retries' },
      throwOnError: true,
    });
    const { data: tasks } = await listTasks({ path: team, throwOnError: true });
    const proposal = chat.messages[2]?.proposal;

    expect(proposal?.state).toBe('created');
    expect(tasks.find((each) => each.id === proposal?.taskId)?.stationId).toBe(
      'station_spec',
    );
  });

  it('starts a chat about improving a station and answers the message', async () => {
    const { data: started } = await startChat({
      path: team,
      body: {
        harness: 'claude-code',
        body: 'Why are its pull requests so large?',
        improving: 'station_implementation',
      },
      throwOnError: true,
    });
    await sendChatMessage({
      path: { ...team, chatId: started.id },
      body: { body: 'Draft the prompt change.' },
      throwOnError: true,
    });
    const { data: journal } = await readChatJournal({
      path: { ...team, chatId: started.id },
      throwOnError: true,
    });

    expect(started.improving?.stationName).toBe('Implementation');
    expect(journal).toHaveLength(2);
  });
});

describe('the mock team area in an empty workspace', () => {
  serveMockApi('empty');

  it('answers empty', async () => {
    const { data: memories } = await listTeamMemories({
      path: team,
      throwOnError: true,
    });
    const { data: chats } = await listChats({ path: team, throwOnError: true });
    const { response } = await readChat({
      path: { ...team, chatId: 'chat_retries' },
    });
    const { response: memory } = await readTeamMemory({
      path: { ...team, memoryId: 'memory_gone' },
    });

    expect(memories).toEqual([]);
    expect(chats).toEqual([]);
    expect(response?.status).toBe(404);
    expect(memory?.status).toBe(404);
  });
});
