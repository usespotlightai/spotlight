import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import type {
  PersonAction,
  RunHumanAction,
} from '@insights/domain/value-objects/person-action.vo';

export class RunActions {
  static readonly NONE = new RunActions(null, null);

  private constructor(
    readonly decidingAction: PersonAction | null,
    readonly answer: PersonAction | null,
  ) {}

  static of(actions: {
    readonly decidingAction: PersonAction | null;
    readonly answer: PersonAction | null;
  }): RunActions {
    if (actions.decidingAction && !actions.decidingAction.decidingKind) {
      throw new InvalidOutcomeError('can be decided only by a deciding action');
    }
    if (actions.answer && !actions.answer.answersQuestion) {
      throw new InvalidOutcomeError('can be answered only by an answer');
    }

    return new RunActions(actions.decidingAction, actions.answer);
  }

  get humanAction(): {
    readonly kind: RunHumanAction;
    readonly at: Date;
  } | null {
    if (this.decidingAction?.decidingKind) {
      return {
        kind: this.decidingAction.decidingKind,
        at: this.decidingAction.at,
      };
    }

    return this.answer ? { kind: 'answered', at: this.answer.at } : null;
  }

  with(action: PersonAction): RunActions {
    if (action.answersQuestion) {
      return this.answer && !action.precedes(this.answer)
        ? this
        : new RunActions(this.decidingAction, action);
    }
    if (action.decidingKind) {
      return this.decidingAction && !action.precedes(this.decidingAction)
        ? this
        : new RunActions(action, this.answer);
    }

    return this;
  }

  knownBy(known: (at: Date) => boolean): RunActions {
    return new RunActions(
      this.decidingAction && known(this.decidingAction.at)
        ? this.decidingAction
        : null,
      this.answer && known(this.answer.at) ? this.answer : null,
    );
  }
}
