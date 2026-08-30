import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';

/** The remote is where Spotlight serves it; the runner resolves it locally. */
export interface CheckoutShape {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
}

/** Reached through Spotlight, at whatever address the runner is listening on. */
export const THROUGH_SPOTLIGHT = 'spotlight:repository';

/** What a runner is handed to carry a run out. */
export interface RunSpecShape {
  readonly checkouts?: readonly CheckoutShape[];
  readonly command: {
    readonly executable: string;
    readonly args: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
  };
  readonly briefing: string;
  readonly handover: { readonly options: readonly string[] };
  readonly continuity: {
    readonly key: string;
    readonly sessionId?: string;
    readonly keep: boolean;
  };
}

/**
 * Everything a run needs to be carried out, kept whole. It crosses to the
 * runner as it is, so it is read back through this rather than cast into.
 */
export class RunSpec {
  private constructor(private readonly parts: RunSpecShape) {}

  static of(parts: RunSpecShape): RunSpec {
    if (parts.briefing.trim().length === 0) {
      throw new InvalidRunSpecError('must say what the work is');
    }
    if (parts.command.executable.trim().length === 0) {
      throw new InvalidRunSpecError('must name something to run');
    }

    return new RunSpec(parts);
  }

  /** A spec read back from storage, where nothing guarantees its shape. */
  static from(raw: unknown): RunSpec | null {
    const parts = raw as Partial<RunSpecShape> | null;

    return parts?.briefing &&
      parts.command &&
      parts.handover &&
      parts.continuity
      ? new RunSpec(parts as RunSpecShape)
      : null;
  }

  get briefing(): string {
    return this.parts.briefing;
  }

  /** The whole of it, for whoever has to write it down or send it on. */
  get value(): RunSpecShape {
    return this.parts;
  }
}
