export class NoteByCallbackCommand {
  constructor(
    readonly token: string,
    readonly body: string,
    readonly idempotencyKey: string | null,
  ) {}
}
