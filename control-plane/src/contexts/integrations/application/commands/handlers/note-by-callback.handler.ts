import type { NoteByCallbackCommand } from '@integrations/application/commands/note-by-callback.command';
import type { CausationPort } from '@integrations/application/ports/causation.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { InvalidCallbackNoteError } from '@integrations/domain/exceptions/invalid-callback-note.error';
import { CallbackNote } from '@integrations/domain/value-objects/callback-note.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

export type NotedByCallback =
  | 'noted'
  | 'rejected'
  | { readonly invalid: string };

const noteIn = (body: string): CallbackNote | { readonly invalid: string } => {
  try {
    return CallbackNote.of(body);
  } catch (error) {
    if (error instanceof InvalidCallbackNoteError) {
      return { invalid: error.message };
    }

    throw error;
  }
};

export class NoteByCallbackHandler implements CommandHandlerPort<
  NoteByCallbackCommand,
  NotedByCallback
> {
  constructor(
    private readonly callbackTokens: HookCallbackTokens,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly history: HookFiringHistoryPort,
    private readonly causation: CausationPort,
  ) {}

  async execute(command: NoteByCallbackCommand): Promise<NotedByCallback> {
    try {
      const note = noteIn(command.body);

      if ('invalid' in note) {
        return note;
      }

      const callbackToken = await this.callbackTokens.findByToken(
        command.token,
      );

      if (!callbackToken) {
        return 'rejected';
      }

      const fired = callbackToken.firing
        ? await this.history.chainOf(
            callbackToken.workspaceId,
            callbackToken.firing,
          )
        : null;
      const noted = await this.causation.runWith(
        (fired ?? this.causation.current()).append(callbackToken.causeLink),
        () =>
          this.notes.noted(
            callbackToken.taskId.value,
            note.body,
            callbackToken.hook.value,
            callbackToken.noteIdempotencyKey(command.idempotencyKey),
          ),
      );

      return noted ? 'noted' : 'rejected';
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
