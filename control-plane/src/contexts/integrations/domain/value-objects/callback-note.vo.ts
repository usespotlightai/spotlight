import { InvalidCallbackNoteError } from '@integrations/domain/exceptions/invalid-callback-note.error';

const LONGEST_CALLBACK_NOTE = 20_000;

export class CallbackNote {
  private constructor(readonly body: string) {}

  static of(body: string): CallbackNote {
    const text = body.trim();

    if (!text || text.length > LONGEST_CALLBACK_NOTE) {
      throw new InvalidCallbackNoteError(LONGEST_CALLBACK_NOTE);
    }

    return new CallbackNote(text);
  }

  equals(other: CallbackNote): boolean {
    return this.body === other.body;
  }
}
