import type { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { HookCallbackGrants } from '@integrations/application/services/hook-callback-grants.service';
import { InvalidCallbackNoteError } from '@integrations/domain/exceptions/invalid-callback-note.error';
import { CallbackNote } from '@integrations/domain/value-objects/callback-note.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

export type NotedByCallback = 'noted' | 'rejected' | 'empty';

const noteIn = (body: string): CallbackNote | null => {
  try {
    return CallbackNote.of(body);
  } catch (error) {
    if (error instanceof InvalidCallbackNoteError) {
      return null;
    }

    throw error;
  }
};

export class NoteByCallbackHandler
  implements CommandHandlerPort<NoteByCallbackCommand, NotedByCallback>
{
  constructor(
    private readonly grants: HookCallbackGrants,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly history: HookFiringHistoryPort,
    private readonly causation: CausationPort,
  ) {}

  async execute(command: NoteByCallbackCommand): Promise<NotedByCallback> {
    try {
      const note = noteIn(command.body);

      if (!note) {
        return 'empty';
      }

      const grant = await this.grants.findByToken(command.token);

      if (!grant) {
        return 'rejected';
      }

      const fired = grant.firing
        ? await this.history.chainOf(grant.workspaceId.value, grant.firing)
        : null;
      const noted = await this.causation.within(
        (fired ?? this.causation.current()).followedBy(grant.causeLink),
        () =>
          this.notes.noted(
            grant.taskId.value,
            note.body,
            grant.hook,
            grant.noteIdempotencyKey(command.idempotencyKey),
          ),
      );

      return noted ? 'noted' : 'rejected';
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
