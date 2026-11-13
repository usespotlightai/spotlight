import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export const BINDING_SUBJECTS = [
  'task',
  'chat',
  'inbox-request',
  'notice',
] as const;

export type BindingSubject = (typeof BINDING_SUBJECTS)[number];

export type BindableEvents = Readonly<
  Record<BindingSubject, readonly string[]>
>;

export const EVENT_ABOUT: Readonly<Record<BindingSubject, string>> = {
  task: 'A task event',
  chat: 'A chat event',
  'inbox-request': 'An inbox request event',
  notice: 'A notice event',
};

export const ABOUT_A_TASK = [
  'task',
  'inbox-request',
] as const satisfies readonly BindingSubject[];

export type TaskBindingSubject = (typeof ABOUT_A_TASK)[number];

export const isAboutATask = (
  subject: BindingSubject,
): subject is TaskBindingSubject =>
  (ABOUT_A_TASK as readonly BindingSubject[]).includes(subject);

export class Binding {
  private constructor(
    readonly event: string,
    readonly about: BindingSubject,
    readonly action: string,
  ) {}

  static aboutOf(event: string, known: BindableEvents): BindingSubject | null {
    return (
      BINDING_SUBJECTS.find((subject) => known[subject].includes(event)) ?? null
    );
  }

  static of(input: {
    event: string;
    action: string;
    known: BindableEvents;
    marked: boolean;
    routed: boolean;
  }): Binding {
    const about = Binding.aboutOf(input.event, input.known);

    if (about === null) {
      throw new InvalidIntegrationPartError(
        `binding on ${input.event}`,
        `must be one of ${BINDING_SUBJECTS.flatMap((subject) => input.known[subject]).join(', ')}`,
      );
    }

    if (!isAboutATask(about) && (input.marked || input.routed)) {
      throw new InvalidIntegrationPartError(
        `binding on ${input.event}`,
        `${EVENT_ABOUT[about]} has no task to mark and no line to route by. Please remove mark and routes`,
      );
    }

    return new Binding(input.event, about, input.action);
  }

  isFor(event: string): boolean {
    return this.event === event;
  }
}
