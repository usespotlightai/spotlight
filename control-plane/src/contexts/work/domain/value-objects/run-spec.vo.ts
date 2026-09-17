import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import type { ToolInputType } from '@work/domain/value-objects/declared-tool.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export interface RunCheckout {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
}

export interface RunCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

export interface RunHandover {
  readonly options: readonly string[];
  readonly noteLimit: number;
}

export interface RunContinuity {
  readonly key: string;
  readonly sessionId?: string;
  readonly keep: boolean;
}

export interface RunToolInput {
  readonly name: string;
  readonly type: ToolInputType;
  readonly description?: string;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export interface RunToolManifest {
  readonly name: string;
  readonly description: string;
  readonly inputs: readonly RunToolInput[];
}

export interface RunSkillFile {
  readonly path: string;
  readonly text: string;
}

export interface RunAttachment {
  readonly id: string;
  readonly path: string;
}

export interface RunSpecParts {
  readonly checkouts?: readonly RunCheckout[];
  readonly command: RunCommand;
  readonly briefing: string;
  readonly handover: RunHandover;
  readonly continuity: RunContinuity;
  readonly skills?: readonly RunSkillFile[];
  readonly manifest?: readonly RunToolManifest[];
  readonly attachments?: readonly RunAttachment[];
}

const outside = (path: string): boolean =>
  path.startsWith('/') || path.includes('..');

const blank = (text: string): boolean => text.trim().length === 0;

const copied = (parts: RunSpecParts): RunSpecParts => ({
  ...(parts.checkouts
    ? {
        checkouts: parts.checkouts.map((each) => ({
          remote: each.remote,
          ...(each.path !== undefined ? { path: each.path } : {}),
          ...(each.branch !== undefined ? { branch: each.branch } : {}),
        })),
      }
    : {}),
  command: {
    executable: parts.command.executable,
    args: [...parts.command.args],
    ...(parts.command.env ? { env: { ...parts.command.env } } : {}),
  },
  briefing: parts.briefing,
  handover: {
    options: [...parts.handover.options],
    noteLimit: parts.handover.noteLimit,
  },
  continuity: {
    key: parts.continuity.key,
    ...(parts.continuity.sessionId !== undefined
      ? { sessionId: parts.continuity.sessionId }
      : {}),
    keep: parts.continuity.keep,
  },
  ...(parts.skills
    ? { skills: parts.skills.map(({ path, text }) => ({ path, text })) }
    : {}),
  ...(parts.manifest
    ? {
        manifest: parts.manifest.map((each) => ({
          name: each.name,
          description: each.description,
          inputs: each.inputs.map((input) => ({
            name: input.name,
            type: input.type,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            required: input.required,
            defaulted: input.defaulted,
            piped: input.piped,
          })),
        })),
      }
    : {}),
  ...(parts.attachments
    ? { attachments: parts.attachments.map(({ id, path }) => ({ id, path })) }
    : {}),
});

const samePart = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => samePart(each, b[index]))
    );
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  const rightKeys = new Set(Object.keys(right));

  return (
    keys.length === rightKeys.size &&
    keys.every((key) => rightKeys.has(key) && samePart(left[key], right[key]))
  );
};

export class RunSpec {
  private constructor(private readonly parts: RunSpecParts) {}

  static of(parts: RunSpecParts): RunSpec {
    if (blank(parts.briefing)) {
      throw new InvalidRunSpecError('must say what the work is');
    }
    if (blank(parts.command.executable)) {
      throw new InvalidRunSpecError('must name something to run');
    }
    if (
      !Number.isInteger(parts.handover.noteLimit) ||
      parts.handover.noteLimit < 0
    ) {
      throw new InvalidRunSpecError('must say how long a note may be');
    }

    for (const checkout of parts.checkouts ?? []) {
      if (blank(checkout.remote)) {
        throw new InvalidRunSpecError('must say where a checkout comes from');
      }
      if (checkout.path !== undefined && outside(checkout.path)) {
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

    return new RunSpec(copied(parts));
  }

  get briefing(): string {
    return this.parts.briefing;
  }

  gives(tool: Tool): boolean {
    return (this.parts.manifest ?? []).some((each) => each.name === tool.value);
  }

  get value(): RunSpecParts {
    return copied(this.parts);
  }

  equals(other: RunSpec): boolean {
    return samePart(this.parts, other.parts);
  }
}
