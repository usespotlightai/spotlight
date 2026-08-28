import { InvalidHarnessCommandError } from '@domain/exceptions/invalid-harness-command.error';

export class HarnessCommand {
  private constructor(
    readonly executable: string,
    readonly args: readonly string[],
  ) {}

  static of(input: {
    executable: string;
    args?: readonly string[];
  }): HarnessCommand {
    const executable = input.executable.trim();

    if (executable.length === 0) {
      throw new InvalidHarnessCommandError('must name an executable');
    }

    return new HarnessCommand(executable, [...(input.args ?? [])]);
  }

  started(): { executable: string; args: readonly string[] } {
    return { executable: this.executable, args: [...this.args] };
  }

  /** The briefing goes last, where a harness takes the prompt to work on. */
  briefedWith(briefing: string): {
    executable: string;
    args: readonly string[];
  } {
    return { executable: this.executable, args: [...this.args, briefing] };
  }

  equals(other: HarnessCommand): boolean {
    return (
      this.executable === other.executable &&
      this.args.length === other.args.length &&
      this.args.every((arg, at) => arg === other.args[at])
    );
  }
}
