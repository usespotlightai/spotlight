import { InvalidCallbackNoteError } from '@integrations/domain/exceptions/invalid-callback-note.error';

export const LONGEST_CALLBACK_NOTE = 20_000;

export class CallbackNote {
  private constructor(readonly body: string) {}

  static of(body: string): CallbackNote {
    const said = body.trim();

    if (!said || said.length > LONGEST_CALLBACK_NOTE) {
      throw new InvalidCallbackNoteError(LONGEST_CALLBACK_NOTE);
    }

    return new CallbackNote(said);
  }

  equals(other: CallbackNote): boolean {
    return this.body === other.body;
  }
}
