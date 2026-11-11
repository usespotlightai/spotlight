export type CommentSurface = 'line' | 'conversation';

export class BotComment {
  private constructor(
    readonly id: number,
    readonly on: CommentSurface,
    readonly login: string,
    readonly opensThread: boolean,
    readonly deleted: boolean,
  ) {}

  static of(input: {
    id: number;
    on: CommentSurface;
    login: string;
    opensThread: boolean;
    deleted: boolean;
  }): BotComment {
    return new BotComment(
      input.id,
      input.on,
      input.login,
      input.opensThread,
      input.deleted,
    );
  }

  isComment(id: number, on: CommentSurface): boolean {
    return this.id === id && this.on === on;
  }

  equals(other: BotComment): boolean {
    return (
      this.id === other.id &&
      this.on === other.on &&
      this.login === other.login &&
      this.opensThread === other.opensThread &&
      this.deleted === other.deleted
    );
  }
}
