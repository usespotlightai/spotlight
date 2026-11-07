import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export type BindingSubject = 'task' | 'chat';

export interface BindableEvents {
  readonly task: readonly string[];
  readonly chat: readonly string[];
}

export class Binding {
  private constructor(
    readonly event: string,
    readonly about: BindingSubject,
    readonly action: string,
  ) {}

  static of(input: {
    event: string;
    action: string;
    known: BindableEvents;
  }): Binding {
    const about: BindingSubject | null = input.known.task.includes(input.event)
      ? 'task'
      : input.known.chat.includes(input.event)
        ? 'chat'
        : null;

    if (about === null) {
      throw new InvalidIntegrationPartError(
        `binding on ${input.event}`,
        `must be one of ${[...input.known.task, ...input.known.chat].join(', ')}`,
      );
    }

    return new Binding(input.event, about, input.action);
  }

  isFor(event: string): boolean {
    return this.event === event;
  }
}
