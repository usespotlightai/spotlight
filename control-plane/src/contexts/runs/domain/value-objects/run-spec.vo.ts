import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import type { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { isRunnerVariable } from '@runs/domain/value-objects/runner-variables';
import type { WarmCheckout } from '@runs/domain/value-objects/warm-line.vo';
import { distinct } from '@shared-kernel/domain/distinct';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import { isEnvironmentVariableName } from '@shared-kernel/domain/value-objects/environment-variable-name';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export interface RunCheckout {
  readonly remote: string;
  readonly path?: string;
  readonly branch?: string;
  readonly base?: string;
  readonly ref?: string;
  readonly diffOf?: 'commits';
  readonly setup?: string;
}

export interface SessionOption {
  readonly id: string;
  readonly value: string;
  readonly optional?: boolean;
}

export const HARNESS_PROTOCOLS = ['acp/1', 'acp/2'] as const;

export type HarnessProtocol = (typeof HARNESS_PROTOCOLS)[number];

export const isHarnessProtocol = (value: unknown): value is HarnessProtocol =>
  HARNESS_PROTOCOLS.some((each) => each === value);

export interface RunCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly protocol?: HarnessProtocol;
  readonly env?: Readonly<Record<string, string>>;
  readonly sessionOptions?: readonly SessionOption[];
}

interface RunHandover {
  readonly options: readonly string[];
  readonly resumeOptions?: readonly string[];
  readonly noteLimit: number;
}

export interface RunResume {
  readonly sessionId?: string;
  readonly resumeSession?: boolean;
  readonly followUp?: string;
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
  readonly readOnly?: true;
}

export interface RunChangedTools {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export interface RunToolChange {
  readonly removed: readonly Tool[];
  readonly added: readonly RunToolManifest[];
}

export const NO_TOOL_CHANGE: RunToolChange = { removed: [], added: [] };

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

export interface RunSandboxVariable {
  readonly variable: string;
  readonly secret: string;
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
  readonly changedTools?: RunChangedTools;
  readonly catalog?: readonly string[];
  readonly attachments?: readonly RunAttachment[];
  readonly diffs?: boolean;
  readonly check?: string;
  readonly startingPoint?: boolean;
  readonly harnessSetup?: RunHarnessSetup;
  readonly settingFiles?: readonly string[];
  readonly injectedSecrets?: readonly string[];
  readonly sandboxEnv?: readonly RunSandboxVariable[];
  readonly harnessKeys?: readonly string[];
  readonly spotlightApi?: boolean;
}

export const RUN_SPEC_FIELDS = [
  'checkouts',
  'command',
  'briefing',
  'handover',
  'resume',
  'skills',
  'skillHomes',
  'manifest',
  'changedTools',
  'catalog',
  'attachments',
  'diffs',
  'check',
  'startingPoint',
  'harnessSetup',
  'settingFiles',
  'injectedSecrets',
  'sandboxEnv',
  'harnessKeys',
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
    ? {
        session: JSON.parse(JSON.stringify(setup.session)) as NonNullable<
          RunHarnessSetup['session']
        >,
      }
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
          ...(each.base !== undefined ? { base: each.base } : {}),
          ...(each.ref !== undefined ? { ref: each.ref } : {}),
          ...(each.diffOf !== undefined ? { diffOf: each.diffOf } : {}),
          ...(each.setup !== undefined ? { setup: each.setup } : {}),
        })),
      }
    : {}),
  command: {
    executable: parts.command.executable,
    args: [...parts.command.args],
    ...(parts.command.protocol ? { protocol: parts.command.protocol } : {}),
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
    ...(parts.handover.resumeOptions?.length
      ? { resumeOptions: [...parts.handover.resumeOptions] }
      : {}),
    noteLimit: parts.handover.noteLimit,
  },
  resume: {
    ...(parts.resume.sessionId !== undefined
      ? { sessionId: parts.resume.sessionId }
      : {}),
    ...(parts.resume.resumeSession ? { resumeSession: true } : {}),
    ...(parts.resume.followUp ? { followUp: parts.resume.followUp } : {}),
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
          ...(each.readOnly ? { readOnly: true as const } : {}),
        })),
      }
    : {}),
  ...(parts.changedTools
    ? {
        changedTools: {
          added: [...parts.changedTools.added],
          removed: [...parts.changedTools.removed],
        },
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
  ...(parts.sandboxEnv?.length
    ? {
        sandboxEnv: parts.sandboxEnv.map(({ variable, secret }) => ({
          variable,
          secret,
        })),
      }
    : {}),
  ...(parts.harnessKeys?.length ? { harnessKeys: [...parts.harnessKeys] } : {}),
  ...(parts.spotlightApi ? { spotlightApi: true } : {}),
});

export const actsBeyondItselfIn = (parts: RunSpecParts): string | null => {
  if ((parts.injectedSecrets?.length ?? 0) > 0) {
    return 'has egress inject secrets';
  }

  if ((parts.sandboxEnv?.length ?? 0) > 0) {
    return 'puts secrets in its sandbox';
  }

  if (parts.spotlightApi) {
    return 'uses Spotlight’s API';
  }

  if (
    (parts.manifest ?? []).some(
      (each) => !each.readOnly || each.integration === undefined,
    )
  ) {
    return 'enables tools that can change data';
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
        throw new InvalidRunSpecError(
          'must put a checkout in the working copy',
        );
      }
    }

    for (const skill of parts.skills ?? []) {
      if (!skill.path || outside(skill.path)) {
        throw new InvalidRunSpecError('must put a skill in the working copy');
      }
    }

    for (const home of parts.skillHomes ?? []) {
      if (!home || outside(home)) {
        throw new InvalidRunSpecError('must put skills in the working copy');
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

    for (const [at, { variable, secret }] of (
      parts.sandboxEnv ?? []
    ).entries()) {
      if (!isEnvironmentVariableName(variable) || !isSecretName(secret)) {
        throw new InvalidRunSpecError(
          'must name each environment variable and the secret it holds',
        );
      }

      if (isRunnerVariable(variable)) {
        throw new InvalidRunSpecError(
          `must not put a secret in ${variable}, which the runner sets in every sandbox`,
        );
      }

      if (Object.keys(parts.command.env ?? {}).includes(variable)) {
        throw new InvalidRunSpecError(
          `must not put a secret in ${variable}, which the harness command sets`,
        );
      }

      if (
        (parts.sandboxEnv ?? [])
          .slice(0, at)
          .some((each) => each.variable === variable)
      ) {
        throw new InvalidRunSpecError(
          `must set environment variable ${variable} once`,
        );
      }
    }

    for (const key of parts.harnessKeys ?? []) {
      if (!isSecretName(key)) {
        throw new InvalidRunSpecError(
          'must name each harness key that egress injects for it',
        );
      }
    }

    for (const attachment of parts.attachments ?? []) {
      if (!attachment.path || outside(attachment.path)) {
        throw new InvalidRunSpecError(
          'must put an attachment in the working copy',
        );
      }
    }

    if (parts.check !== undefined && blank(parts.check)) {
      throw new InvalidRunSpecError('must say what checks its change');
    }

    const changed = parts.changedTools;

    if (
      changed &&
      (changed.added.length + changed.removed.length === 0 ||
        changed.added.some(
          (name) =>
            changed.removed.includes(name) ||
            !(parts.manifest ?? []).some((each) => each.name === name),
        ) ||
        changed.removed.some((name) =>
          (parts.manifest ?? []).some((each) => each.name === name),
        ))
    ) {
      throw new InvalidRunSpecError(
        'must list as changed only the tools it gained or lost',
      );
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
          ...(this.parts.resume.followUp
            ? { followUp: this.parts.resume.followUp }
            : {}),
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

  withToolChange({ removed, added }: RunToolChange): RunSpec {
    const manifest = this.parts.manifest ?? [];
    const lost = manifest.filter(
      (each) =>
        removed.some((tool) => tool.called === each.name) &&
        !added.some((other) => other.name === each.name),
    );
    const kept = manifest.filter((each) => !lost.includes(each));
    const gained = added.filter(
      (each, at) =>
        !kept.some((other) => other.name === each.name) &&
        added.findIndex((other) => other.name === each.name) === at,
    );
    const { changedTools, ...rest } = this.parts;

    if (gained.length === 0 && lost.length === 0 && !changedTools) {
      return this;
    }

    return RunSpec.of({
      ...rest,
      manifest: [...kept, ...gained],
      ...(gained.length > 0 || lost.length > 0
        ? {
            changedTools: {
              added: gained.map((each) => each.name),
              removed: lost.map((each) => each.name),
            },
          }
        : {}),
    });
  }

  serves({ removed, added }: RunToolChange): boolean {
    const names = (this.parts.manifest ?? []).map((each) => each.name);

    return (
      added.every((each) => names.includes(each.name)) &&
      removed.every(
        (tool) =>
          !names.includes(tool.called) ||
          added.some((each) => each.name === tool.called),
      )
    );
  }

  wearingHarnessKeys(keys: readonly SecretName[]): RunSpec {
    if (keys.length === 0) {
      return this;
    }

    return RunSpec.of({
      ...this.parts,
      command: {
        ...this.parts.command,
        env: {
          ...this.parts.command.env,
          ...Object.fromEntries(keys.map((key) => [key.value, key.standIn])),
        },
      },
      harnessKeys: keys.map((key) => key.value),
    });
  }

  get harnessKeys(): readonly SecretName[] {
    return (this.parts.harnessKeys ?? []).map((each) => SecretName.of(each));
  }

  get injectedSecrets(): readonly SecretName[] {
    return distinct(
      [
        ...(this.parts.injectedSecrets ?? []),
        ...(this.parts.harnessKeys ?? []),
      ].map((each) => SecretName.of(each)),
    );
  }

  get sandboxEnv(): readonly RunSandboxVariable[] {
    return this.parts.sandboxEnv ?? [];
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

  get warmCheckouts(): readonly WarmCheckout[] | null {
    const checkouts = this.parts.checkouts ?? [];
    const placed = checkouts.flatMap(({ path, setup }) =>
      path === undefined ? [] : [{ path, setup: setup ?? null }],
    );

    return placed.length === checkouts.length ? placed : null;
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
