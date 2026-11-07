import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { Action } from '@integrations/domain/value-objects/action.vo';
import type { BindingSubject } from '@integrations/domain/value-objects/binding.vo';

export class DefinedActions {
  private constructor(private readonly actions: ReadonlyMap<string, Action>) {}

  static of(actions: readonly Action[]): DefinedActions {
    return new DefinedActions(
      new Map(actions.map((action) => [action.name, action])),
    );
  }

  named(name: string, by: string): Action {
    const action = this.actions.get(name);

    if (!action) {
      throw new InvalidIntegrationPartError(
        by,
        `names undefined action ${name}`,
      );
    }

    return action;
  }

  forTool(name: string, by: string): Action {
    return this.withoutUploads(
      name,
      by,
      'Only an event in on sends files. Please name an action without uploads',
    );
  }

  forSchedule(name: string, by: string): Action {
    return this.withoutUploads(
      name,
      by,
      'Only an event in on sends files. Please name an action without uploads',
    );
  }

  forBinding(name: string, about: BindingSubject, by: string): Action {
    return about === 'chat'
      ? this.withoutUploads(
          name,
          by,
          'A chat event has no files. Please name an action without uploads',
        )
      : this.named(name, by);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  get all(): readonly string[] {
    return [...this.actions.keys()];
  }

  private withoutUploads(name: string, by: string, why: string): Action {
    const action = this.named(name, by);

    if (action.uploads) {
      throw new InvalidIntegrationPartError(
        by,
        `names the action ${name}, which uploads files. ${why}`,
      );
    }

    return action;
  }
}
