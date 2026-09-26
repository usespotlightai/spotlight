export class NoteByCallbackCommand {
  constructor(
    readonly token: string,
    readonly body: string,
  ) {}
}
