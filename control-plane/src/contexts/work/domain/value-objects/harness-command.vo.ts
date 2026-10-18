import { InvalidHarnessCommandError } from '@work/domain/exceptions/invalid-harness-command.error';
import type {
  RunCommand,
  SessionOption,
} from '@work/domain/value-objects/run-spec.vo';

export class HarnessCommand {
  private constructor(
    readonly executable: string,
    readonly args: readonly string[],
    readonly env: Readonly<Record<string, string>>,
    readonly sessionOptions: readonly SessionOption[],
  ) {}

  static of(input: {
    executable: string;
    args?: readonly string[];
    env?: Readonly<Record<string, string>>;
    sessionOptions?: readonly SessionOption[];
  }): HarnessCommand {
    const executable = input.executable.trim();

    if (executable.length === 0) {
      throw new InvalidHarnessCommandError('must name an executable');
    }

    const sessionOptions = (input.sessionOptions ?? []).map(
      ({ id, value, optional }) => ({
        id: id.trim(),
        value: value.trim(),
        ...(optional ? { optional: true } : {}),
      }),
    );

    if (sessionOptions.some(({ id, value }) => !id || !value)) {
      throw new InvalidHarnessCommandError(
        'must name each session option and its value',
      );
    }

    return new HarnessCommand(
      executable,
      [...(input.args ?? [])],
      { ...(input.env ?? {}) },
      sessionOptions,
    );
  }

  started(also: Readonly<Record<string, string>> = {}): RunCommand {
    const env = { ...this.env, ...also };

    return {
      executable: this.executable,
      args: [...this.args],
      ...(Object.keys(env).length > 0 ? { env } : {}),
      ...(this.sessionOptions.length > 0
        ? { sessionOptions: this.sessionOptions.map((each) => ({ ...each })) }
        : {}),
    };
  }

  equals(other: HarnessCommand): boolean {
    const named = Object.keys(this.env);

    return (
      this.executable === other.executable &&
      this.args.length === other.args.length &&
      this.args.every((arg, at) => arg === other.args[at]) &&
      named.length === Object.keys(other.env).length &&
      named.every((name) => this.env[name] === other.env[name]) &&
      this.sessionOptions.length === other.sessionOptions.length &&
      this.sessionOptions.every(
        (option, at) =>
          option.id === other.sessionOptions[at]?.id &&
          option.value === other.sessionOptions[at]?.value &&
          Boolean(option.optional) ===
            Boolean(other.sessionOptions[at]?.optional),
      )
    );
  }
}
