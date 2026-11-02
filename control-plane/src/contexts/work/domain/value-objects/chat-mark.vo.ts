import type { Mark } from '@work/domain/value-objects/mark.vo';

export class ChatMark {
  private constructor(
    readonly mark: Mark,
    readonly finds: boolean,
  ) {}

  static finding(mark: Mark): ChatMark {
    return new ChatMark(mark, true);
  }

  static ambient(mark: Mark): ChatMark {
    return new ChatMark(mark, false);
  }

  static of(mark: Mark, finds: boolean): ChatMark {
    return new ChatMark(mark, finds);
  }

  equals(other: ChatMark): boolean {
    return this.finds === other.finds && this.mark.equals(other.mark);
  }
}
