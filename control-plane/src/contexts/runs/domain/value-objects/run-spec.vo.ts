import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import type { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

// Do not send a host address to a runner. Name each remote as Spotlight serves it.
export const REMOTE_VIA_GIT_PROXY = 'spotlight:repository';

export interface RunCheckout {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
  readonly ref?: string;
  readonly diffOf?: 'commits';
  readonly setup?: string;
}

export interface SessionOption {
  readonly id: string;
  readonly value: string;
  readonly optional?: boolean;
}

export interface RunCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly sessionOptions?: readonly SessionOption[];
}

interface RunHandover {
  readonly options: readonly string[];
  readonly noteLimit: number;
}

export interface RunResume {
  readonly sessionId?: string;
  readonly resumeSession?: boolean;
}

export interface RunToolInput {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description?: string;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export interface RunToolApproval {
  readonly because: string;
}

export interface RunToolManifest {
  readonly name: string;
  readonly description: string;
  readonly inputs: readonly RunToolInput[];
  readonly approval: RunToolApproval | null;
  readonly integration?: string;
  readonly output?: JsonObject;
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
  readonly askKinds: readonly string[];
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
  readonly resume: RunResume;
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
  readonly injectedSecrets?: readonly string[];
  readonly spotlightApi?: boolean;
}

export const RUN_WIRE_FIELDS = [
  'checkouts',
  'command',
  'briefing',
  'handover',
  'resume',
  'skills',
  'skillHomes',
  'manifest',
  'catalog',
  'attachments',
  'diffs',
  'check',
  'startingPoint',
  'harnessSetup',
  'settingFiles',
  'injectedSecrets',
  'spotlightApi',
] as const satisfies readonly (keyof RunSpecParts)[];

const outside = (path: string): boolean =>
  path.startsWith('/') || path.includes('..');

const blank = (text: string): boolean => text.trim().length === 0;

const isSecretName = (name: string): boolean => {
  try {
    return SecretName.of(name).value === name;
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
  askKinds: [...setup.askKinds],
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
    ...(parts.command.sessionOptions?.length
      ? {
          sessionOptions: parts.command.sessionOptions.map(
            ({ id, value, optional }) => ({
              id,
              value,
              ...(optional ? { optional: true } : {}),
            }),
          ),
        }
      : {}),
  },
  briefing: parts.briefing,
  handover: {
    options: [...parts.handover.options],
    noteLimit: parts.handover.noteLimit,
  },
  resume: {
    ...(parts.resume.sessionId !== undefined
      ? { sessionId: parts.resume.sessionId }
      : {}),
    ...(parts.resume.resumeSession ? { resumeSession: true } : {}),
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
            schema: structuredClone(input.schema),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            required: input.required,
            defaulted: input.defaulted,
            stdin: input.stdin,
          })),
          approval: each.approval ? { because: each.approval.because } : null,
          ...(each.integration !== undefined
            ? { integration: each.integration }
            : {}),
          ...(each.output !== undefined
            ? { output: structuredClone(each.output) }
            : {}),
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
  ...(parts.injectedSecrets?.length
    ? { injectedSecrets: [...parts.injectedSecrets] }
    : {}),
  ...(parts.spotlightApi ? { spotlightApi: true } : {}),
});

export const actsBeyondItselfIn = (parts: RunSpecParts): string | null => {
  if ((parts.injectedSecrets?.length ?? 0) > 0) {
    return 'has egress inject secrets';
  }

  if (parts.spotlightApi) {
    return 'uses Spotlight’s API';
  }

  if ((parts.manifest?.length ?? 0) > 0) {
    return 'enables tools';
  }

  if ((parts.catalog?.length ?? 0) > 0) {
    return 'pins catalog tools';
  }

  if ((parts.harnessSetup?.mcpServers.length ?? 0) > 0) {
    return 'starts MCP servers';
  }

  if (parts.resume.sessionId || parts.resume.resumeSession) {
    return 'carries on a conversation';
  }

  if (parts.startingPoint) {
    return 'reports where it started';
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
      parts.command.sessionOptions?.some(
        (option) => blank(option.id) || blank(option.value),
      )
    ) {
      throw new InvalidRunSpecError(
        'must name each harness session option and its value',
      );
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
        throw new InvalidRunSpecError('must put a checkout in the workspace');
      }
    }

    for (const skill of parts.skills ?? []) {
      if (!skill.path || outside(skill.path)) {
        throw new InvalidRunSpecError('must put a skill in the workspace');
      }
    }

    for (const home of parts.skillHomes ?? []) {
      if (!home || outside(home)) {
        throw new InvalidRunSpecError('must put skills in the workspace');
      }
    }

    for (const file of parts.harnessSetup?.files ?? []) {
      if (!file.path || outside(file.path)) {
        throw new InvalidRunSpecError(
          'must put a harness setting in the state directory',
        );
      }
    }

    for (const path of parts.settingFiles ?? []) {
      if (!path || outside(path)) {
        throw new InvalidRunSpecError(
          'must put a harness setting in the state directory',
        );
      }
    }

    for (const secret of parts.injectedSecrets ?? []) {
      if (!isSecretName(secret)) {
        throw new InvalidRunSpecError(
          'must name each secret that egress injects for it',
        );
      }
    }

    for (const attachment of parts.attachments ?? []) {
      if (!attachment.path || outside(attachment.path)) {
        throw new InvalidRunSpecError(
          'must put an attachment in the workspace',
        );
      }
    }

    if (parts.check !== undefined && blank(parts.check)) {
      throw new InvalidRunSpecError('must say what checks its change');
    }

    return new RunSpec(copied(parts));
  }

  get briefing(): string {
    return this.parts.briefing;
  }

  enables(tool: Tool): boolean {
    return (this.parts.manifest ?? []).some((each) => each.name === tool.value);
  }

  pinned(tool: Tool): Tool | null {
    return (
      (this.parts.catalog ?? [])
        .map((each) => Tool.of(each))
        .find((each) => each.called === tool.called) ?? null
    );
  }

  get continuesASession(): boolean {
    return Boolean(this.parts.resume.sessionId);
  }

  get resumesSession(): boolean {
    return this.parts.resume.resumeSession === true;
  }

  resumingIn(session: HarnessSession | null): RunSpec {
    return new RunSpec(
      copied({
        ...this.parts,
        resume: {
          ...(session
            ? { sessionId: session.value }
            : this.parts.resume.sessionId !== undefined
              ? { sessionId: this.parts.resume.sessionId }
              : {}),
          resumeSession: true,
        },
      }),
    );
  }

  join(checkouts: readonly RunCheckout[]): RunSpec {
    const folders = new Set(this.checkoutFolders);
    const joining = checkouts.filter((each) => {
      if (
        each.path === undefined ||
        blank(each.path) ||
        folders.has(each.path)
      ) {
        return false;
      }
      folders.add(each.path);
      return true;
    });

    return joining.length === 0
      ? this
      : RunSpec.of({
          ...this.parts,
          checkouts: [...(this.parts.checkouts ?? []), ...joining],
        });
  }

  get injectedSecrets(): readonly SecretName[] {
    return (this.parts.injectedSecrets ?? []).map((each) =>
      SecretName.of(each),
    );
  }

  get injectsSpotlightApi(): boolean {
    return this.parts.spotlightApi === true;
  }

  get reportsStartingPoint(): boolean {
    return this.parts.startingPoint === true;
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
