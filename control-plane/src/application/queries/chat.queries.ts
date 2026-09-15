export class ListChatsQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
  ) {}
}

export class ReadChatQuery {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly viewerId: string,
  ) {}
}

export class ReadChatJournalQuery {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly viewerId: string,
  ) {}
}
