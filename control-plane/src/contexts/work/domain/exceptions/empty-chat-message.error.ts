import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';

export class EmptyChatMessageError extends InvalidChatMessageError {
  constructor() {
    super('needs text, a file, a trace or a station to improve');
    this.name = 'EmptyChatMessageError';
  }
}
