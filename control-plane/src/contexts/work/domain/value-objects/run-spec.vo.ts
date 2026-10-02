import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { ToolInputType } from '@work/domain/value-objects/declared-tool.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

export interface RunCheckout {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
  readonly ref?: string;
  readonly diffOf?: 'commits';
  readonly setup?: string;
}

export interface RunCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

interface RunHandover {
  readonly options: readonly string[];
  readonly noteLimit: number;
}

export interface RunContinuity {
  readonly key: string;
  readonly sessionId?: string;
  readonly resumes?: boolean;
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

export interface RunFile {
  readonly path: string;
  readonly text: string;
}

export interface RunMcpServer {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: readonly { readonly name: string; readonly value: string }[];
}

export interface RunHarnessSetup {
  readonly files: readonly RunFile[];
  readonly session?: Readonly<Record<string, unknown>>;
  readonly mcpServers: readonly RunMcpServer[];
  readonly asks: readonly string[];
}

export interface RunAttachment {
  readonly id: string;
  readonly path: string;
}

interface RunReplayCheckout {
  readonly path: string;
  readonly commit: string;
  readonly repository: string;
}

export interface RunReplay {
  readonly archive: string | null;
  readonly checkouts: readonly RunReplayCheckout[];
  readonly movesOnAfter: readonly string[];
}

export type RunSearch = Readonly<Record<string, never>>;

export interface RunSpecParts {
  readonly checkouts?: readonly RunCheckout[];
  readonly command: RunCommand;
  readonly briefing: string;
  readonly handover: RunHandover;
  readonly continuity: RunContinuity;
  readonly skills?: readonly RunFile[];
  readonly skillHomes?: readonly string[];
  readonly manifest?: readonly RunToolManifest[];
  readonly catalog?: readonly string[];
  readonly attachments?: readonly RunAttachment[];
  readonly diffs?: boolean;
  readonly check?: string;
  readonly startingPoint?: boolean;
  readonly harnessSetup?: RunHarnessSetup;
  readonly settingFiles?: readonly string[];
  readonly wears?: readonly string[];
  readonly replay?: RunReplay;
  readonly search?: RunSearch;
}

const outside = (path: string): boolean =>
  path.startsWith('/') || path.includes('..');

const blank = (text: string): boolean => text.trim().length === 0;

const isSecretName = (worn: string): boolean => {
  try {
    return SecretName.of(worn).value === worn;
  } catch {
    return false;
  }
};

export const checkoutFoldersOf = (
  checkouts: readonly RunCheckout[],
): readonly string[] =>
  checkouts.flatMap((each) =>
    each.path && !blank(each.path) ? [each.path] : [],
  );

const setupCopied = (setup: RunHarnessSetup): RunHarnessSetup => ({
  files: setup.files.map(({ path, text }) => ({ path, text })),
  ...(setup.session
    ? { session: JSON.parse(JSON.stringify(setup.session)) }
    : {}),
  mcpServers: setup.mcpServers.map((server) => ({
    name: server.name,
    command: server.command,
    args: [...server.args],
    env: server.env.map(({ name, value }) => ({ name, value })),
  })),
  asks: [...setup.asks],
});

const copied = (parts: RunSpecParts): RunSpecParts => ({
  ...(parts.checkouts
    ? {
        checkouts: parts.checkouts.map((each) => ({
          remote: each.remote,
          ...(each.path !== undefined ? { path: each.path } : {}),
          ...(each.branch !== undefined ? { branch: each.branch } : {}),
          ...(each.ref !== undefined ? { ref: each.ref } : {}),
          ...(each.diffOf !== undefined ? { diffOf: each.diffOf } : {}),
          ...(each.setup !== undefined ? { setup: each.setup } : {}),
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
    ...(parts.continuity.resumes ? { resumes: true } : {}),
  },
  ...(parts.skills
    ? { skills: parts.skills.map(({ path, text }) => ({ path, text })) }
    : {}),
  ...(parts.skillHomes?.length ? { skillHomes: [...parts.skillHomes] } : {}),
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
  ...(parts.catalog ? { catalog: [...parts.catalog] } : {}),
  ...(parts.attachments
    ? { attachments: parts.attachments.map(({ id, path }) => ({ id, path })) }
    : {}),
  ...(parts.diffs === undefined ? {} : { diffs: parts.diffs }),
  ...(parts.check !== undefined ? { check: parts.check } : {}),
  ...(parts.startingPoint ? { startingPoint: true } : {}),
  ...(parts.harnessSetup
    ? { harnessSetup: setupCopied(parts.harnessSetup) }
    : {}),
  ...(parts.settingFiles?.length
    ? { settingFiles: [...parts.settingFiles] }
    : {}),
  ...(parts.wears?.length ? { wears: [...parts.wears] } : {}),
  ...(parts.replay
    ? {
        replay: {
          archive: parts.replay.archive,
          checkouts: parts.replay.checkouts.map(
            ({ path, commit, repository }) => ({ path, commit, repository }),
          ),
          movesOnAfter: [...parts.replay.movesOnAfter],
        },
      }
    : {}),
  ...(parts.search ? { search: {} } : {}),
});

const replayRefusal = (parts: RunSpecParts): string | null => {
  const replay = parts.replay;

  if (!replay) {
    return null;
  }

  if (
    (parts.wears?.length ?? 0) > 0 ||
    (parts.manifest?.length ?? 0) > 0 ||
    (parts.catalog?.length ?? 0) > 0 ||
    (parts.harnessSetup?.mcpServers.length ?? 0) > 0
  ) {
    return 'must give a replay no tools, MCP servers or secrets';
  }

  if (parts.startingPoint) {
    return 'must not have a replay report where it started';
  }

  if (parts.continuity.sessionId || parts.continuity.resumes) {
    return 'must start a replay in a conversation of its own';
  }

  const checkouts = parts.checkouts ?? [];
  const replayed = new Map(
    replay.checkouts.map((each) => [each.path, each.commit]),
  );

  if (
    replayed.size !== replay.checkouts.length ||
    checkouts.length !== replayed.size ||
    checkouts.some(
      (each) =>
        each.path === undefined ||
        each.branch !== undefined ||
        each.ref === undefined ||
        replayed.get(each.path) !== each.ref,
    )
  ) {
    return 'must check a replay’s repositories out at the commits it replays, and nothing else';
  }

  return null;
};

const searchRefusal = (parts: RunSpecParts): string | null => {
  if (!parts.search) {
    return null;
  }

  if (parts.replay) {
    return 'must not replay a run and search at once';
  }

  if ((parts.checkouts?.length ?? 0) > 0) {
    return 'must give a search no checkouts';
  }

  if (
    (parts.wears?.length ?? 0) > 0 ||
    (parts.manifest?.length ?? 0) > 0 ||
    (parts.catalog?.length ?? 0) > 0 ||
    (parts.harnessSetup?.mcpServers.length ?? 0) > 0
  ) {
    return 'must give a search no tools, MCP servers or secrets';
  }

  if ((parts.attachments?.length ?? 0) > 0) {
    return 'must give a search no attachments';
  }

  if (
    (parts.skills?.length ?? 0) > 0 ||
    (parts.skillHomes?.length ?? 0) > 0 ||
    (parts.settingFiles?.length ?? 0) > 0 ||
    parts.harnessSetup
  ) {
    return 'must give a search no skills or harness settings';
  }

  if (parts.diffs || parts.check !== undefined) {
    return 'must not have a search hand over a diff or check a change';
  }

  if (parts.handover.options.length > 0 || parts.handover.noteLimit > 0) {
    return 'must give a search nothing to hand over to';
  }

  if (parts.startingPoint) {
    return 'must not have a search report where it started';
  }

  if (parts.continuity.sessionId || parts.continuity.resumes) {
    return 'must start a search in a conversation of its own';
  }

  return null;
};

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

    for (const home of parts.skillHomes ?? []) {
      if (!home || outside(home)) {
        throw new InvalidRunSpecError('must keep skills in the workspace');
      }
    }

    for (const file of parts.harnessSetup?.files ?? []) {
      if (!file.path || outside(file.path)) {
        throw new InvalidRunSpecError(
          'must keep a harness setting in the state directory',
        );
      }
    }

    for (const path of parts.settingFiles ?? []) {
      if (!path || outside(path)) {
        throw new InvalidRunSpecError(
          'must keep a harness setting in the state directory',
        );
      }
    }

    for (const worn of parts.wears ?? []) {
      if (!isSecretName(worn)) {
        throw new InvalidRunSpecError('must name each secret it wears');
      }
    }

    for (const attachment of parts.attachments ?? []) {
      if (!attachment.path || outside(attachment.path)) {
        throw new InvalidRunSpecError(
          'must keep an attachment in the workspace',
        );
      }
    }

    if (parts.check !== undefined && blank(parts.check)) {
      throw new InvalidRunSpecError('must say what checks its change');
    }

    const refused = replayRefusal(parts) ?? searchRefusal(parts);

    if (refused) {
      throw new InvalidRunSpecError(refused);
    }

    return new RunSpec(copied(parts));
  }

  get replay(): RunReplay | null {
    return copied(this.parts).replay ?? null;
  }

  get isReplay(): boolean {
    return this.parts.replay !== undefined;
  }

  get isSearch(): boolean {
    return this.parts.search !== undefined;
  }

  get briefing(): string {
    return this.parts.briefing;
  }

  gives(tool: Tool): boolean {
    return (this.parts.manifest ?? []).some((each) => each.name === tool.value);
  }

  pinned(tool: Tool): Tool | null {
    return (
      (this.parts.catalog ?? [])
        .map((each) => Tool.of(each))
        .find((each) => each.called === tool.called) ?? null
    );
  }

  get continuity(): ContinuityKey | null {
    return blank(this.parts.continuity.key)
      ? null
      : ContinuityKey.of(this.parts.continuity.key);
  }

  get continuesASession(): boolean {
    return Boolean(this.parts.continuity.sessionId);
  }

  get resumes(): boolean {
    return this.parts.continuity.resumes === true;
  }

  resumingIn(session: HarnessSession | null): RunSpec {
    return new RunSpec(
      copied({
        ...this.parts,
        continuity: {
          key: this.parts.continuity.key,
          ...(session
            ? { sessionId: session.value }
            : this.parts.continuity.sessionId !== undefined
              ? { sessionId: this.parts.continuity.sessionId }
              : {}),
          resumes: true,
        },
      }),
    );
  }

  get wears(): readonly SecretName[] {
    return (this.parts.wears ?? []).map((each) => SecretName.of(each));
  }

  get check(): string | null {
    return this.parts.check ?? null;
  }

  get checkoutSetups(): ReadonlyMap<string, string> {
    return new Map(
      (this.parts.checkouts ?? []).flatMap((each) =>
        each.path !== undefined && each.setup !== undefined
          ? [[each.path, each.setup]]
          : [],
      ),
    );
  }

  get checkoutFolders(): readonly string[] {
    return checkoutFoldersOf(this.parts.checkouts ?? []);
  }

  get value(): RunSpecParts {
    return copied(this.parts);
  }

  equals(other: RunSpec): boolean {
    return samePart(this.parts, other.parts);
  }
}
