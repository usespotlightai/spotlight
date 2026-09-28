import { randomUUID } from 'node:crypto';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { JournalEntry } from '@work/application/ports/run-journal.port';
import { TouchedFiles } from '@work/application/services/touched-files';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunJournalReader } from '@work/infrastructure/persistence/drizzle/readers/run-journal.reader';
import { journalsOfTask } from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let journal: DrizzleRunJournal;
let reader: DrizzleRunJournalReader;

beforeAll(async () => {
  held = await openDatabase('run_journal_changes');
  db = held.db;
  journal = new DrizzleRunJournal(new DrizzleContext(db));
  reader = new DrizzleRunJournalReader(db, {
    mayView: async () => true,
  } as unknown as WorkspaceAccessPort);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

type Said =
  | { call: string }
  | { edit: string; path: string }
  | { hook: string }
  | { chunk: string };

const entries = (...said: Said[]): JournalEntry[] =>
  said.map((each, index) => {
    const at = new Date(Date.UTC(2026, 8, 27, 9, 0, index));
    const seq = index + 1;

    if ('hook' in each) {
      return { seq, type: 'output', at, message: each.hook, data: 'aGk=' };
    }
    if ('call' in each) {
      return {
        seq,
        type: 'output',
        at,
        data: sent({
          sessionUpdate: 'tool_call',
          toolCallId: each.call,
          title: 'Edit',
          rawInput: { file: 'a large input' },
        }),
      };
    }
    if ('edit' in each) {
      return {
        seq,
        type: 'output',
        at,
        data: sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: each.edit,
          status: 'completed',
          rawOutput: 'x'.repeat(10_000),
          content: [
            {
              type: 'diff',
              path: each.path,
              oldText: 'before',
              newText: 'after',
            },
          ],
        }),
      };
    }
    return {
      seq,
      type: 'output',
      at,
      data: sent({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: each.chunk },
      }),
    };
  });

const runOf = async (
  taskId: string,
  folders: readonly string[],
  createdAt: Date,
): Promise<RunId> => {
  const runId = randomUUID();

  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    taskId,
    state: 'claimed',
    spec: {
      checkouts: folders.map((path) => ({
        remote: 'spotlight:repository',
        path,
      })),
    },
    createdAt,
  });

  return RunId.of(runId);
};

const requeued = async (runId: RunId, attempt: number) => {
  await db
    .update(schema.run)
    .set({ attempt })
    .where(eq(schema.run.id, runId.value));
};

const at = (minute: number) => new Date(Date.UTC(2026, 8, 27, 8, minute));

describe('reading what a task’s runs changed', () => {
  it('names the paths each run changed on the attempt it is on, with its own checkouts', async () => {
    const taskId = randomUUID();
    const first = await runOf(taskId, ['api', 'web'], at(0));
    const second = await runOf(taskId, ['api', ' '], at(1));
    const quiet = await runOf(taskId, ['api'], at(2));
    const elsewhere = await runOf(randomUUID(), ['api'], at(3));

    await journal.append(
      RunAttempt.of(first, 1),
      entries(
        { hook: 'workspace ready' },
        { call: 'call_1' },
        { chunk: 'Retrying uploads.' },
        { edit: 'call_1', path: '/runs/r1/api/src/uploads.ts' },
        { call: 'call_2' },
        { edit: 'call_2', path: '/runs/r1/web/src/Upload.tsx' },
      ),
    );
    await journal.append(
      RunAttempt.of(second, 1),
      entries(
        { call: 'call_1' },
        { edit: 'call_1', path: '/runs/r2/api/src/abandoned.ts' },
      ),
    );
    await requeued(second, 2);
    await journal.append(
      RunAttempt.of(second, 2),
      entries(
        { call: 'call_1' },
        { edit: 'call_1', path: '/runs/r2/api/src/retry.ts' },
        { edit: 'call_9', path: '/runs/r2/api/src/unseen.ts' },
      ),
    );
    await journal.append(
      RunAttempt.of(quiet, 1),
      entries({ chunk: 'Nothing to change.' }),
    );
    await journal.append(
      RunAttempt.of(elsewhere, 1),
      entries(
        { call: 'call_1' },
        { edit: 'call_1', path: '/runs/r4/api/src/other.ts' },
      ),
    );

    expect(await reader.changesOfTask(TaskId.of(taskId))).toEqual([
      {
        runId: first.value,
        checkouts: ['api', 'web'],
        paths: ['/runs/r1/api/src/uploads.ts', '/runs/r1/web/src/Upload.tsx'],
      },
      {
        runId: second.value,
        checkouts: ['api'],
        paths: ['/runs/r2/api/src/retry.ts'],
      },
    ]);
  });

  it('names the same paths the full journal shows as changes', async () => {
    const taskId = randomUUID();
    const runId = await runOf(taskId, ['api'], at(10));

    await journal.append(
      RunAttempt.of(runId, 1),
      entries(
        { call: 'call_1' },
        { edit: 'call_1', path: '/runs/r1/api/src/draft.ts' },
        { edit: 'call_1', path: '/runs/r1/api/src/uploads.ts' },
        { chunk: 'Now the retry.' },
        { call: 'call_2' },
        { edit: 'call_2', path: '/runs/r1/api/src/retry.ts' },
        { edit: 'call_3', path: '/runs/r1/api/src/never-called.ts' },
      ),
    );

    const [read] = await reader.changesOfTask(TaskId.of(taskId));
    const [full] = await journalsOfTask(db, TaskId.of(taskId));

    expect(read?.paths).toEqual(
      full?.steps.flatMap((step) =>
        step.change?.path ? [step.change.path] : [],
      ),
    );
  });

  it('names nothing for a task no run of which changed a file', async () => {
    const taskId = randomUUID();
    const runId = await runOf(taskId, ['api'], at(20));

    await journal.append(
      RunAttempt.of(runId, 1),
      entries({ chunk: 'Looked, changed nothing.' }),
    );

    expect(await reader.changesOfTask(TaskId.of(taskId))).toEqual([]);
    expect(await reader.changesOfTask(TaskId.of(randomUUID()))).toEqual([]);
  });

  it('gives the files a task touched in the repositories its line works', async () => {
    const taskId = randomUUID();
    const runId = await runOf(taskId, ['api', 'web', 'docs'], at(30));

    await journal.append(
      RunAttempt.of(runId, 1),
      entries(
        { call: 'call_1' },
        { edit: 'call_1', path: '/runs/r1/api/src/uploads.ts' },
        { call: 'call_2' },
        { edit: 'call_2', path: '/runs/r1/docs/uploads.md' },
        { call: 'call_3' },
        { edit: 'call_3', path: '/tmp/scratch.ts' },
        { call: 'call_4' },
        { edit: 'call_4', path: '/runs/r1/api/src/uploads.ts' },
        { call: 'call_5' },
        { edit: 'call_5', path: '/runs/r1/web/src/Upload.tsx' },
      ),
    );

    const touched = await new TouchedFiles(
      reader,
      { changedIn: async () => [] } as unknown as PullRequestPort,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      { now: () => new Date(), sleep: () => new Promise(() => {}) },
    ).onTask(
      {
        id: TaskId.of(taskId),
        workspaceId: WorkspaceId.of('ws_1'),
        reviewedHead: null,
        pullRequest: null,
      } as unknown as Task,
      { repositories: { all: [API, WEB] } } as unknown as Line,
    );

    expect(
      touched.map((each) => `${each.repository.value}:${each.path}`),
    ).toEqual(['acme/api:src/uploads.ts', 'acme/web:src/Upload.tsx']);
  });
});
