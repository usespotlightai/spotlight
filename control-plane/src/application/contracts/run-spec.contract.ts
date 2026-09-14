import type { ToolInputType } from '@domain/entities/declared-tool.entity';
import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';

export interface CheckoutShape {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
}

export const THROUGH_SPOTLIGHT = 'spotlight:repository';

export const TRACE_PARENT_VAR = 'TRACEPARENT';

interface ToolInputManifestShape {
  readonly name: string;
  readonly type: ToolInputType;
  readonly description?: string;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export interface ToolManifestShape {
  readonly name: string;
  readonly description: string;
  readonly inputs: readonly ToolInputManifestShape[];
}

export const SKILL_FOLDER_LIMITS = {
  files: 50,
  characters: 512 * 1024,
} as const;

export interface SkillFileShape {
  readonly path: string;
  readonly text: string;
}

export interface AttachmentShape {
  readonly id: string;
  readonly path: string;
}

const outside = (path: string | undefined): boolean =>
  path?.startsWith('/') === true || path?.includes('..') === true;

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
  readonly manifest?: readonly ToolManifestShape[];
  readonly attachments?: readonly AttachmentShape[];
  readonly skills?: readonly SkillFileShape[];
}

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
      if (outside(checkout.path)) {
        throw new InvalidRunSpecError('must keep a checkout in the workspace');
      }
    }

    for (const skill of parts.skills ?? []) {
      if (!skill.path || outside(skill.path)) {
        throw new InvalidRunSpecError('must keep a skill in the workspace');
      }
    }

    for (const attachment of parts.attachments ?? []) {
      if (!attachment.path || outside(attachment.path)) {
        throw new InvalidRunSpecError(
          'must keep an attachment in the workspace',
        );
      }
    }

    return parts;
  },

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

  toolsGiven(raw: unknown): readonly string[] {
    return (RunSpecContract.from(raw)?.manifest ?? []).map((each) => each.name);
  },

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
