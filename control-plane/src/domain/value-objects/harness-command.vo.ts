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

  started(also: Readonly<Record<string, string>> = {}): {
    executable: string;
    args: readonly string[];
    env?: Readonly<Record<string, string>>;
  } {
    const started = { executable: this.executable, args: [...this.args] };
    const env = { ...this.env, ...also };

    return Object.keys(env).length === 0 ? started : { ...started, env };
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
