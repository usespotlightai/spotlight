import type { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { HookCallbacksPort } from '@integrations/application/ports/hook-callbacks.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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

      return (await this.notes.noted(holder.taskId, body, holder.hook))
        ? 'noted'
        : 'refused';
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
