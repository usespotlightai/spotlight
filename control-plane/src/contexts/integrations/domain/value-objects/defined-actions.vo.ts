import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import {
  type ActionCaller,
  CALLER_ABOUT,
  sendsFiles,
} from '@integrations/domain/value-objects/action-caller.vo';
import type { Action } from '@integrations/domain/value-objects/action.vo';

export class DefinedActions {
  private constructor(private readonly actions: ReadonlyMap<string, Action>) {}

  static of(actions: readonly Action[]): DefinedActions {
    return new DefinedActions(
      new Map(actions.map((action) => [action.name, action])),
    );
  }

  named(name: string, at: string): Action {
    const action = this.actions.get(name);

    if (!action) {
      throw new InvalidIntegrationPartError(
        at,
        `names undefined action ${name}`,
      );
    }

    return action;
  }

  calledBy(name: string, caller: ActionCaller, at: string): Action {
    const action = this.named(name, at);

    if (action.uploads && !sendsFiles(caller)) {
      throw new InvalidIntegrationPartError(
        at,
        `names the action ${name}, which uploads files. ${CALLER_ABOUT[caller]} has no files. Please name an action without uploads`,
      );
    }

    return action;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  get all(): readonly string[] {
    return [...this.actions.keys()];
  }
}
