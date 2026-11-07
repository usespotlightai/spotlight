import type {
  HookTaskNotesPort,
  LoopNotice,
  LoopNoticeReport,
} from '@integrations/application/ports/hook-task-notes.port';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

const failureOf = (error: unknown): HookFailure => {
  if (!(error instanceof DomainError || error instanceof ApplicationError)) {
    return HookFailure.unavailable(
      error instanceof Error ? error.message : String(error),
    );
  }

  return error.kind === 'conflict'
    ? HookFailure.unavailable(error.message)
    : HookFailure.errored(error.message);
};

export class HookTaskNotes implements HookTaskNotesPort {
  constructor(private readonly notes: TaskNotesFromHooksPort) {}

  async loopNotice(report: LoopNoticeReport): Promise<LoopNotice> {
    try {
      return {
        kind: 'sent',
        onTask: await this.notes.failed({
          taskId: report.taskId.value,
          stationKey: report.stationKey.value,
          hook: report.hook.value,
          code: report.loop.code,
          reason: report.loop.reason,
          receivedAs: report.receivedAs,
        }),
      };
    } catch (error) {
      return { kind: 'failed', failure: failureOf(error) };
    }
  }

  movedOn(taskId: TaskId, stationKey: StationKey): Promise<boolean> {
    return this.notes.movedOn(taskId.value, stationKey.value);
  }
}
