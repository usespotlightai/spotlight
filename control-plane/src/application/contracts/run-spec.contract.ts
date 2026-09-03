import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';

/** The remote is where Spotlight serves it; the runner resolves it locally. */
export interface CheckoutShape {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
}

/** Reached through Spotlight, at whatever address the runner is listening on. */
export const THROUGH_SPOTLIGHT = 'spotlight:repository';

/** What a harness reads to know which trace its reporting belongs to. */
export const TRACE_PARENT_VAR = 'TRACEPARENT';

/** What a runner is handed to carry a run out. */
export interface RunSpecShape {
  readonly checkouts?: readonly CheckoutShape[];
  readonly command: {
    readonly executable: string;
    readonly args: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
  };
  readonly briefing: string;
  readonly handover: {
    readonly options: readonly string[];
    readonly noteLimit: number;
  };
  readonly continuity: {
    readonly key: string;
    readonly sessionId?: string;
    readonly keep: boolean;
  };
  /** What this run may reach for. Absent is none of them. */
  readonly tools?: readonly string[];
}

/**
 * How a run is written down for a runner. It is an agreement with something
 * outside this process, so it is checked here rather than trusted: what the
 * work is stays the domain's, and how it crosses the wire stays this.
 */
export const RunSpecContract = {
  of(parts: RunSpecShape): RunSpecShape {
    if (parts.briefing.trim().length === 0) {
      throw new InvalidRunSpecError('must say what the work is');
    }
    if (parts.command.executable.trim().length === 0) {
      throw new InvalidRunSpecError('must name something to run');
    }
    if (!Array.isArray(parts.handover?.options)) {
      throw new InvalidRunSpecError('must say what may be handed over to');
    }
    if (
      !Number.isInteger(parts.handover.noteLimit) ||
      parts.handover.noteLimit < 0
    ) {
      throw new InvalidRunSpecError('must say how long a note may be');
    }

    for (const checkout of parts.checkouts ?? []) {
      if (checkout.remote.trim().length === 0) {
        throw new InvalidRunSpecError('must say where a checkout comes from');
      }
      // A path reaching outside the workspace is one the runner would have to
      // refuse, so it is refused here instead.
      if (checkout.path?.startsWith('/') || checkout.path?.includes('..')) {
        throw new InvalidRunSpecError('must keep a checkout in the workspace');
      }
    }

    return parts;
  },

  /**
   * A spec a caller handed in, where nothing about it is guaranteed. The
   * command is not theirs to give: how to start a harness is Spotlight's.
   */
  ordered(raw: unknown, command: RunSpecShape['command']): RunSpecShape {
    const given = raw as Partial<RunSpecShape> | null;

    if (!given || typeof given !== 'object') {
      throw new InvalidRunSpecError('must be described');
    }

    return RunSpecContract.of({
      checkouts: given.checkouts,
      command,
      briefing: typeof given.briefing === 'string' ? given.briefing : '',
      handover: {
        options: given.handover?.options ?? [],
        noteLimit: given.handover?.noteLimit ?? 0,
      },
      continuity: {
        key: given.continuity?.key ?? '',
        sessionId: given.continuity?.sessionId,
        keep: given.continuity?.keep ?? false,
      },
    });
  },

  /** A spec read back from storage, where nothing guarantees its shape. */
  from(raw: unknown): RunSpecShape | null {
    const parts = raw as Partial<RunSpecShape> | null;

    return parts?.briefing &&
      parts.command &&
      parts.handover &&
      parts.continuity
      ? (parts as RunSpecShape)
      : null;
  },
};
