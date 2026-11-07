import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { LoopNotices } from '@integrations/infrastructure/acl/loop-notices.adapter';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';
import { describe, expect, it, vi } from 'vitest';

class TaskGoneError extends DomainError {
  readonly kind = 'not-found' as const;
}

const REPORT = {
  taskId: TaskId.of('task_1'),
  stationKey: StationKey.of('build'),
  hook: 'audit',
  loop: HookFailure.of('loop', 'It would loop'),
  receivedAs: 'loop:firing_1',
};

const noticesFailingWith = (error: unknown) =>
  new LoopNotices({
    noted: vi.fn(),
    failed: vi.fn(async () => {
      throw error;
    }),
    movedOn: vi.fn(),
  } satisfies TaskNotesFromHooksPort);

describe('LoopNotices', () => {
  it('reports how Work took the notice', async () => {
    const notices = new LoopNotices({
      noted: vi.fn(),
      failed: vi.fn(async () => 'superseded' as const),
      movedOn: vi.fn(),
    });

    await expect(notices.send(REPORT)).resolves.toEqual({
      kind: 'sent',
      onTask: 'superseded',
    });
  });

  it('ends at once when Work refuses the notice', async () => {
    const notice = await noticesFailingWith(
      new TaskGoneError('No task task_1'),
    ).send(REPORT);

    expect(notice.kind === 'failed' && notice.failure.code).toBe('errored');
  });

  it('tries again later when Work could not be reached', async () => {
    const notice = await noticesFailingWith(new Error('db went away')).send(
      REPORT,
    );

    expect(notice.kind === 'failed' && notice.failure.code).toBe('unavailable');
  });
});
