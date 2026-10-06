import type { ConfigPullRequestRefusal } from '@replays/domain/value-objects/config-pull-request-state';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const LONGEST_MESSAGE = 2_000;

export type WantedValue =
  | string
  | number
  | boolean
  | null
  | readonly WantedValue[];

export class ConfigPullRequestReason {
  private constructor(
    readonly code: ConfigPullRequestRefusal,
    readonly message: string,
    readonly attribute: string | null,
    readonly expression: string | null,
    readonly wanted: WantedValue | null,
  ) {}

  static of(input: {
    code: ConfigPullRequestRefusal;
    message: string;
    attribute?: string | null;
    expression?: string | null;
    wanted?: WantedValue | null;
  }): ConfigPullRequestReason {
    const message = input.message.trim();

    if (message.length === 0) {
      throw new InconsistentStateError(
        'config pull request',
        'was refused without saying why',
      );
    }

    return new ConfigPullRequestReason(
      input.code,
      message.slice(0, LONGEST_MESSAGE),
      input.attribute ?? null,
      input.expression ?? null,
      input.wanted ?? null,
    );
  }

  static noSource(lineKey: string): ConfigPullRequestReason {
    return ConfigPullRequestReason.of({
      code: 'no-source',
      message: `Line ${lineKey} has no Terraform source. Please add a source block with repository and path to spotlight_line.`,
    });
  }
}
