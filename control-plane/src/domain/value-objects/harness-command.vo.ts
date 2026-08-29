import { InvalidHarnessCommandError } from '@domain/exceptions/invalid-harness-command.error';

export class HarnessCommand {
  private constructor(
    readonly executable: string,
    readonly args: readonly string[],
    readonly env: Readonly<Record<string, string>>,
  ) {}

  static of(input: {
    executable: string;
    args?: readonly string[];
    // What this harness needs telling, such as where it may keep its own state
    // between runs. A value may name a runner directory as
    // `${SPOTLIGHT_STATE_DIR}`, which only the runner can expand.
    env?: Readonly<Record<string, string>>;
  }): HarnessCommand {
    const executable = input.executable.trim();

    if (executable.length === 0) {
      throw new InvalidHarnessCommandError('must name an executable');
    }

    return new HarnessCommand(executable, [...(input.args ?? [])], {
      ...(input.env ?? {}),
    });
  }

  started(): {
    executable: string;
    args: readonly string[];
    env?: Readonly<Record<string, string>>;
  } {
    const started = { executable: this.executable, args: [...this.args] };

    return Object.keys(this.env).length === 0
      ? started
      : { ...started, env: { ...this.env } };
  }

  equals(other: HarnessCommand): boolean {
    const named = Object.keys(this.env);

    return (
      this.executable === other.executable &&
      this.args.length === other.args.length &&
      this.args.every((arg, at) => arg === other.args[at]) &&
      named.length === Object.keys(other.env).length &&
      named.every((name) => this.env[name] === other.env[name])
    );
  }
}
