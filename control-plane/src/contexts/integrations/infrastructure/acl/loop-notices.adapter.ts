import type {
  LoopNotice,
  LoopNoticeReport,
  LoopNoticesPort,
} from '@integrations/application/ports/loop-notices.port';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
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

export class LoopNotices implements LoopNoticesPort {
  constructor(private readonly notes: TaskNotesFromHooksPort) {}

  async send(report: LoopNoticeReport): Promise<LoopNotice> {
    try {
      return {
        kind: 'sent',
        onTask: await this.notes.failed({
          taskId: report.taskId.value,
          stationKey: report.stationKey.value,
          hook: report.hook,
          code: report.loop.code,
          reason: report.loop.reason,
          receivedAs: report.receivedAs,
        }),
      };
    } catch (error) {
      return { kind: 'failed', failure: failureOf(error) };
    }
  }
}
