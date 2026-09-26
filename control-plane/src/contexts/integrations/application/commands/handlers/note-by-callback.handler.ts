import type { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { HookCallbacksPort } from '@integrations/application/ports/hook-callbacks.port';
import type { HookFiringsPort } from '@integrations/application/ports/hook-firings.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

export type NotedByCallback = 'noted' | 'refused' | 'empty';

const LONGEST_NOTE = 20_000;

export class NoteByCallbackHandler
  implements CommandHandlerPort<NoteByCallbackCommand, NotedByCallback>
{
  constructor(
    private readonly callbacks: HookCallbacksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly firings: HookFiringsPort,
    private readonly causation: CausationPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: NoteByCallbackCommand): Promise<NotedByCallback> {
    try {
      const body = command.body.trim();

      if (!body || body.length > LONGEST_NOTE) {
        return 'empty';
      }

      const holder = await this.callbacks.heldBy(
        command.token,
        this.clock.now(),
      );

      if (!holder) {
        return 'refused';
      }

      const fired = holder.firing
        ? await this.firings.chainOf(holder.workspaceId, holder.firing)
        : null;
      const noted = await this.causation.within(
        (fired ?? this.causation.current()).followedBy({
          kind: 'callback',
          key: `callback:${holder.hook}:${holder.taskId}`,
          saying: `a note by callback from the hook ${holder.hook}`,
        }),
        () =>
          this.notes.noted(
            holder.taskId,
            body,
            holder.hook,
            command.idempotencyKey
              ? `callback:${holder.taskId}:${holder.firing ?? holder.hook}:${command.idempotencyKey}`
              : null,
          ),
      );

      return noted ? 'noted' : 'refused';
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
