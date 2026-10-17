import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
} from '@shared-kernel/domain/services/json-value';
import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';
import {
  checkoutFoldersOf,
  type RunAttachment,
  type RunCheckout,
  type RunCommand,
  type RunContinuity,
  type RunFile,
  type RunHarnessSetup,
  type RunMcpServer,
  type RunReplay,
  type RunSearch,
  RunSpec,
  type RunSpecParts,
  type RunToolApproval,
  type RunToolInput,
  type RunToolManifest,
} from '@work/domain/value-objects/run-spec.vo';

export type ToolManifestShape = RunToolManifest;
export type SkillFileShape = RunFile;
export type AttachmentShape = RunAttachment;
export type RunSpecShape = RunSpecParts;
export type HarnessSetupShape = RunHarnessSetup;

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
  const input = objectAt(raw, 'its checkouts');
  const path = optionalStringAt(input.path, 'where a checkout goes');
  const branch = optionalStringAt(input.branch, 'which branch to check out');
  const ref = optionalStringAt(input.ref, 'which ref to check out');
  const diffOf = optionalStringAt(input.diffOf, 'what its change stack diffs');
  const setup = optionalStringAt(input.setup, 'how its checkout is made ready');

  if (diffOf !== undefined && diffOf !== 'commits') {
    throw new InvalidRunSpecError(
      'must diff a checkout by its commits or its worktree',
    );
  }

  return {
    remote: stringAt(input.remote, 'where a checkout comes from'),
    ...(path !== undefined ? { path } : {}),
    ...(branch !== undefined ? { branch } : {}),
    ...(ref !== undefined ? { ref } : {}),
    ...(diffOf !== undefined ? { diffOf } : {}),
    ...(setup !== undefined ? { setup } : {}),
  };
};

const commandOf = (raw: unknown): RunCommand => {
  const input = objectAt(raw, 'what to run');
  const env =
    input.env === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(objectAt(input.env, 'the environment')).map(
            ([name, value]) => [name, stringAt(value, 'the environment')],
          ),
        );

  return {
    executable: stringAt(input.executable, 'what to run'),
    args: listAt(input.args, 'what to run with', (arg) =>
      stringAt(arg, 'what to run with'),
    ),
    ...(env ? { env } : {}),
  };
};

const inputSchemaOf = (raw: unknown): JsonObject =>
  isJsonObject(raw) && isJsonValue(raw)
    ? raw
    : unreadable('the shape a tool input takes');

const toolInputOf = (raw: unknown): RunToolInput => {
  const input = objectAt(raw, 'what a tool takes');
  const description = optionalStringAt(input.description, 'what a tool takes');

  return {
    name: stringAt(input.name, 'what a tool takes'),
    schema: inputSchemaOf(input.schema),
    ...(description !== undefined ? { description } : {}),
    required: booleanAt(input.required, 'what a tool takes'),
    defaulted: booleanAt(input.defaulted, 'what a tool takes'),
    stdin: booleanAt(input.stdin, 'what a tool takes'),
  };
};

const toolApprovalOf = (raw: unknown): RunToolApproval | null =>
  raw === null
    ? null
    : {
        because: stringAt(
          objectAt(raw, 'why a tool waits for a person').because,
          'why a tool waits for a person',
        ),
      };

const toolOutputOf = (raw: unknown): JsonObject =>
  isJsonObject(raw) && isJsonValue(raw)
    ? raw
    : unreadable('what a tool answered before');

const toolOf = (raw: unknown): RunToolManifest => {
  const input = objectAt(raw, 'its tools');
  const integration = optionalStringAt(
    input.integration,
    'the integration a tool comes from',
  );

  return {
    name: stringAt(input.name, 'its tools'),
    description: stringAt(input.description, 'its tools'),
    inputs: listAt(input.inputs, 'what a tool takes', toolInputOf),
    approval: toolApprovalOf(input.approval),
    ...(integration !== undefined ? { integration } : {}),
    ...(input.output !== undefined
      ? { output: toolOutputOf(input.output) }
      : {}),
  };
};

const fileOf =
  (where: string) =>
  (raw: unknown): RunFile => {
    const input = objectAt(raw, where);

    return {
      path: stringAt(input.path, where),
      text: stringAt(input.text, where),
    };
  };

const attachmentOf = (raw: unknown): RunAttachment => {
  const input = objectAt(raw, 'its attachments');

  return {
    id: stringAt(input.id, 'its attachments'),
    path: stringAt(input.path, 'its attachments'),
  };
};

const mcpServerOf = (raw: unknown): RunMcpServer => {
  const input = objectAt(raw, 'its MCP servers');

  return {
    name: stringAt(input.name, 'its MCP servers'),
    command: stringAt(input.command, 'its MCP servers'),
    args: listAt(input.args, 'its MCP servers', (arg) =>
      stringAt(arg, 'its MCP servers'),
    ),
    env: listAt(input.env, 'its MCP servers', (each) => {
      const variable = objectAt(each, 'its MCP servers');

      return {
        name: stringAt(variable.name, 'its MCP servers'),
        value: stringAt(variable.value, 'its MCP servers'),
      };
    }),
  };
};

const harnessSetupOf = (raw: unknown): RunHarnessSetup => {
  const input = objectAt(raw, 'how its harness is set up');

  return {
    files: listAt(
      input.files,
      'how its harness is set up',
      fileOf('how its harness is set up'),
    ),
    ...(input.session === undefined
      ? {}
      : { session: objectAt(input.session, 'how its harness is set up') }),
    mcpServers: listAt(input.mcpServers, 'its MCP servers', mcpServerOf),
    askKinds: listAt(
      input.askKinds,
      'which permissions its harness asks a person about',
      (each) =>
        stringAt(each, 'which permissions its harness asks a person about'),
    ),
  };
};

const continuityOf = (raw: unknown): RunContinuity => {
  const input = objectAt(raw, 'where to carry on');
  const sessionId = optionalStringAt(
    input.sessionId,
    'which conversation to carry on',
  );

  const resumes =
    input.resumes === undefined
      ? false
      : booleanAt(input.resumes, 'whether it takes up a paused conversation');

  return {
    key: stringAt(input.key, 'where to carry on'),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(resumes ? { resumes } : {}),
  };
};

const replayOf = (raw: unknown): RunReplay => {
  const input = objectAt(raw, 'what it replays');

  return {
    archive:
      input.archive === null
        ? null
        : stringAt(input.archive, 'the archive a replay starts from'),
    checkouts: listAt(input.checkouts, 'what a replay checks out', (each) => {
      const checkout = objectAt(each, 'what a replay checks out');

      return {
        path: stringAt(checkout.path, 'what a replay checks out'),
        commit: stringAt(checkout.commit, 'what a replay checks out'),
        repository: stringAt(checkout.repository, 'what a replay checks out'),
      };
    }),
    movesOnAfter: listAt(
      input.movesOnAfter,
      'what a replay moves on after',
      (each) => stringAt(each, 'what a replay moves on after'),
    ),
  };
};

const searchOf = (raw: unknown): RunSearch => {
  objectAt(raw, 'what it searches');

  return {};
};

const handoverOf = (raw: unknown) => {
  const input = objectAt(raw, 'what may be handed over to');

  return {
    options: listAt(input.options, 'what may be handed over to', (each) =>
      stringAt(each, 'what may be handed over to'),
    ),
    noteLimit: numberAt(input.noteLimit, 'how long a note may be'),
  };
};

const read = (raw: unknown): RunSpec => {
  const input = objectAt(raw, 'the run');
  const checkouts = optionalListAt(
    input.checkouts,
    'its checkouts',
    checkoutOf,
  );
  const skills = optionalListAt(
    input.skills,
    'its skills',
    fileOf('its skills'),
  );
  const skillHomes = optionalListAt(
    input.skillHomes,
    'where skills are stored',
    (each) => stringAt(each, 'where skills are stored'),
  );
  const manifest = optionalListAt(input.manifest, 'its tools', toolOf);
  const catalog = optionalListAt(input.catalog, 'its catalog tools', (each) =>
    stringAt(each, 'its catalog tools'),
  );
  const attachments = optionalListAt(
    input.attachments,
    'its attachments',
    attachmentOf,
  );

  const injectedSecrets = optionalListAt(
    input.injectedSecrets,
    'the secrets that egress injects for it',
    (each) => stringAt(each, 'the secrets that egress injects for it'),
  );

  const settingFiles = optionalListAt(
    input.settingFiles,
    'where its harness stores settings',
    (each) => stringAt(each, 'where its harness stores settings'),
  );

  const spotlightApi =
    input.spotlightApi === undefined
      ? undefined
      : booleanAt(input.spotlightApi, 'whether it uses Spotlight’s API');
  const diffs = input.diffs;
  const check = optionalStringAt(input.check, 'what checks its change');
  const startingPoint = input.startingPoint;
  const replay =
    input.replay === undefined ? undefined : replayOf(input.replay);
  const search =
    input.search === undefined ? undefined : searchOf(input.search);
  const harnessSetup =
    input.harnessSetup === undefined
      ? undefined
      : harnessSetupOf(input.harnessSetup);

  return RunSpec.of({
    ...(checkouts ? { checkouts } : {}),
    command: commandOf(input.command),
    briefing: stringAt(input.briefing, 'what the work is'),
    handover: handoverOf(input.handover),
    continuity: continuityOf(input.continuity),
    ...(skills ? { skills } : {}),
    ...(skillHomes ? { skillHomes } : {}),
    ...(manifest ? { manifest } : {}),
    ...(catalog ? { catalog } : {}),
    ...(attachments ? { attachments } : {}),
    ...(diffs === undefined
      ? {}
      : {
          diffs: booleanAt(diffs, 'whether it reports the diff it leaves'),
        }),
    ...(check === undefined ? {} : { check }),
    ...(startingPoint === undefined
      ? {}
      : {
          startingPoint: booleanAt(
            startingPoint,
            'whether it reports where it started',
          ),
        }),
    ...(harnessSetup ? { harnessSetup } : {}),
    ...(settingFiles ? { settingFiles } : {}),
    ...(injectedSecrets ? { injectedSecrets } : {}),
    ...(spotlightApi ? { spotlightApi } : {}),
    ...(replay ? { replay } : {}),
    ...(search ? { search } : {}),
  });
};

export const RunSpecContract = {
  ordered(raw: unknown, command: RunCommand): RunSpec {
    const input = objectAt(raw, 'the run');
    const handover = input.handover as Json | undefined;
    const continuity = input.continuity as Json | undefined;

    return read({
      checkouts: input.checkouts,
      command,
      briefing: input.briefing ?? '',
      handover: {
        options: handover?.options ?? [],
        noteLimit: handover?.noteLimit ?? 0,
      },
      continuity: {
        key: continuity?.key ?? '',
        sessionId: continuity?.sessionId,
      },
    });
  },

  checkoutFoldersIn(raw: unknown): readonly string[] {
    return checkoutFoldersOf(
      raw === null || raw === undefined
        ? []
        : listAt(raw, 'its checkouts', checkoutOf),
    );
  },

  continuityOf(continuity: Continuity): RunContinuity {
    return {
      key: continuity.key.value,
      ...(continuity.sessionId
        ? { sessionId: continuity.sessionId.value }
        : {}),
    };
  },

  toWire(spec: RunSpec): RunSpecShape {
    return spec.value;
  },

  from(raw: unknown): RunSpec {
    try {
      return read(raw);
    } catch (error) {
      if (error instanceof InvalidRunSpecError) {
        throw new InconsistentStateError(
          'run',
          `has a spec that no longer reads: ${error.message}`,
        );
      }

      throw error;
    }
  },
};
