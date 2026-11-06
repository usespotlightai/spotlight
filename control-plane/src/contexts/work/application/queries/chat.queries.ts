import type { PageRequest } from '@shared-kernel/application/dto/page.dto';

export class ListChatsQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly page: PageRequest,
  ) {}
}

export class ReadChatQuery {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly viewerId: string,
  ) {}
}

export class ListChatJournalRunsQuery {
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
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
