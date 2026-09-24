import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';
import {
  TOOL_INPUT_TYPES,
  type ToolInputType,
} from '@work/domain/value-objects/declared-tool.vo';
import {
  type RunAttachment,
  type RunCheckout,
  type RunCommand,
  type RunContinuity,
  type RunSkillFile,
  RunSpec,
  type RunSpecParts,
  type RunToolInput,
  type RunToolManifest,
} from '@work/domain/value-objects/run-spec.vo';

export type ToolManifestShape = RunToolManifest;
export type SkillFileShape = RunSkillFile;
export type AttachmentShape = RunAttachment;
export type RunSpecShape = RunSpecParts;

export const THROUGH_SPOTLIGHT = 'spotlight:repository';

export const TRACE_PARENT_VAR = 'TRACEPARENT';

export const SKILL_FILE = 'SKILL.md';

export const SKILL_FOLDER_LIMITS = {
  files: 50,
  characters: 512 * 1024,
} as const;

type Json = Record<string, unknown>;

const unreadable = (what: string): never => {
  throw new InvalidRunSpecError(`must describe ${what}`);
};

const objectAt = (raw: unknown, what: string): Json =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Json)
    : unreadable(what);

const stringAt = (raw: unknown, what: string): string =>
  typeof raw === 'string' ? raw : unreadable(what);

const optionalStringAt = (raw: unknown, what: string): string | undefined =>
  raw === undefined ? undefined : stringAt(raw, what);

const booleanAt = (raw: unknown, what: string): boolean =>
  typeof raw === 'boolean' ? raw : unreadable(what);

const numberAt = (raw: unknown, what: string): number =>
  typeof raw === 'number' ? raw : unreadable(what);

const listAt = <T>(
  raw: unknown,
  what: string,
  each: (item: unknown) => T,
): T[] => (Array.isArray(raw) ? raw.map(each) : unreadable(what));

const optionalListAt = <T>(
  raw: unknown,
  what: string,
  each: (item: unknown) => T,
): T[] | undefined => (raw === undefined ? undefined : listAt(raw, what, each));

const checkoutOf = (raw: unknown): RunCheckout => {
  const given = objectAt(raw, 'its checkouts');
  const path = optionalStringAt(given.path, 'where a checkout goes');
  const branch = optionalStringAt(given.branch, 'which branch to check out');
  const ref = optionalStringAt(given.ref, 'which ref to check out');
  const diffOf = optionalStringAt(given.diffOf, 'what its change stack diffs');

  if (diffOf !== undefined && diffOf !== 'commits') {
    throw new InvalidRunSpecError(
      'diffs a checkout by its commits, or its work',
    );
  }

  return {
    remote: stringAt(given.remote, 'where a checkout comes from'),
    ...(path !== undefined ? { path } : {}),
    ...(branch !== undefined ? { branch } : {}),
    ...(ref !== undefined ? { ref } : {}),
    ...(diffOf !== undefined ? { diffOf } : {}),
  };
};

const commandOf = (raw: unknown): RunCommand => {
  const given = objectAt(raw, 'what to run');
  const env =
    given.env === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(objectAt(given.env, 'the environment')).map(
            ([name, value]) => [name, stringAt(value, 'the environment')],
          ),
        );

  return {
    executable: stringAt(given.executable, 'what to run'),
    args: listAt(given.args, 'what to run with', (arg) =>
      stringAt(arg, 'what to run with'),
    ),
    ...(env ? { env } : {}),
  };
};

const inputTypeOf = (raw: unknown): ToolInputType =>
  (TOOL_INPUT_TYPES as readonly unknown[]).includes(raw)
    ? (raw as ToolInputType)
    : unreadable('what a tool takes');

const toolInputOf = (raw: unknown): RunToolInput => {
  const given = objectAt(raw, 'what a tool takes');
  const description = optionalStringAt(given.description, 'what a tool takes');

  return {
    name: stringAt(given.name, 'what a tool takes'),
    type: inputTypeOf(given.type),
    ...(description !== undefined ? { description } : {}),
    required: booleanAt(given.required, 'what a tool takes'),
    defaulted: booleanAt(given.defaulted, 'what a tool takes'),
    piped: booleanAt(given.piped, 'what a tool takes'),
  };
};

const toolOf = (raw: unknown): RunToolManifest => {
  const given = objectAt(raw, 'its tools');

  return {
    name: stringAt(given.name, 'its tools'),
    description: stringAt(given.description, 'its tools'),
    inputs: listAt(given.inputs, 'what a tool takes', toolInputOf),
  };
};

const skillOf = (raw: unknown): RunSkillFile => {
  const given = objectAt(raw, 'its skills');

  return {
    path: stringAt(given.path, 'its skills'),
    text: stringAt(given.text, 'its skills'),
  };
};

const attachmentOf = (raw: unknown): RunAttachment => {
  const given = objectAt(raw, 'its attachments');

  return {
    id: stringAt(given.id, 'its attachments'),
    path: stringAt(given.path, 'its attachments'),
  };
};

const continuityOf = (raw: unknown): RunContinuity => {
  const given = objectAt(raw, 'where to carry on');
  const sessionId = optionalStringAt(
    given.sessionId,
    'which conversation to carry on',
  );

  return {
    key: stringAt(given.key, 'where to carry on'),
    ...(sessionId !== undefined ? { sessionId } : {}),
    keep: booleanAt(given.keep, 'whether to keep the workspace'),
  };
};

const handoverOf = (raw: unknown) => {
  const given = objectAt(raw, 'what may be handed over to');

  return {
    options: listAt(given.options, 'what may be handed over to', (each) =>
      stringAt(each, 'what may be handed over to'),
    ),
    noteLimit: numberAt(given.noteLimit, 'how long a note may be'),
  };
};

const read = (raw: unknown): RunSpec => {
  const given = objectAt(raw, 'the run');
  const checkouts = optionalListAt(
    given.checkouts,
    'its checkouts',
    checkoutOf,
  );
  const skills = optionalListAt(given.skills, 'its skills', skillOf);
  const manifest = optionalListAt(given.manifest, 'its tools', toolOf);
  const catalog = optionalListAt(given.catalog, 'its catalog tools', (each) =>
    stringAt(each, 'its catalog tools'),
  );
  const attachments = optionalListAt(
    given.attachments,
    'its attachments',
    attachmentOf,
  );

  const diffs = given.diffs;

  return RunSpec.of({
    ...(checkouts ? { checkouts } : {}),
    command: commandOf(given.command),
    briefing: stringAt(given.briefing, 'what the work is'),
    handover: handoverOf(given.handover),
    continuity: continuityOf(given.continuity),
    ...(skills ? { skills } : {}),
    ...(manifest ? { manifest } : {}),
    ...(catalog ? { catalog } : {}),
    ...(attachments ? { attachments } : {}),
    ...(diffs === undefined
      ? {}
      : {
          diffs: booleanAt(diffs, 'whether it reports the diff it leaves'),
        }),
  });
};

export const RunSpecContract = {
  ordered(raw: unknown, command: RunCommand): RunSpec {
    const given = objectAt(raw, 'the run');
    const handover = given.handover as Json | undefined;
    const continuity = given.continuity as Json | undefined;

    return read({
      checkouts: given.checkouts,
      command,
      briefing: given.briefing ?? '',
      handover: {
        options: handover?.options ?? [],
        noteLimit: handover?.noteLimit ?? 0,
      },
      continuity: {
        key: continuity?.key ?? '',
        sessionId: continuity?.sessionId,
        keep: continuity?.keep ?? false,
      },
    });
  },

  continuityOf(continuity: Continuity): RunContinuity {
    return {
      key: continuity.key.value,
      ...(continuity.sessionId
        ? { sessionId: continuity.sessionId.value }
        : {}),
      keep: true,
    };
  },

  toWire(spec: RunSpec): RunSpecShape {
    return spec.value;
  },

  from(raw: unknown): RunSpec | null {
    try {
      return read(raw);
    } catch {
      return null;
    }
  },
};
