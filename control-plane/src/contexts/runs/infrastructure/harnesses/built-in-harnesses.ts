import { Injectable } from '@nestjs/common';
import type {
  HarnessNote,
  HarnessProfileShape,
  ProfileReview,
  ReadyProfileShape,
} from '@runs/application/contracts/harness-profile.contract';
import type { RunCommandShape } from '@runs/application/contracts/run-spec.contract';
import type {
  Chosen,
  HarnessCatalogueEntry,
  HarnessLaunchPort,
  PreparedHarness,
  SkillsHome,
} from '@runs/application/ports/harness-launch.port';
import type { HarnessProfileReviewPort } from '@runs/application/ports/harness-profile-review.port';
import { HarnessCommand } from '@runs/domain/value-objects/harness-command.vo';
import {
  type HarnessSettings,
  type PermissionKind,
  type ReadyProfile,
  readyProfile,
} from '@runs/domain/value-objects/ready-profile';
import type { SessionOption } from '@runs/domain/value-objects/run-spec.vo';
import { claudeCodeProfile } from '@runs/infrastructure/harnesses/profiles/claude-code.profile';
import { codexProfile } from '@runs/infrastructure/harnesses/profiles/codex.profile';
import { cursorProfile } from '@runs/infrastructure/harnesses/profiles/cursor.profile';
import { opencodeProfile } from '@runs/infrastructure/harnesses/profiles/opencode.profile';
import {
  isObject,
  noteOnNative,
  type ProfileTranslator,
  type TranslatedProfile,
} from '@runs/infrastructure/harnesses/profiles/profile-translator';
import { EFFORTS } from '@shared-kernel/domain/value-objects/effort.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { parse } from 'smol-toml';

type ModelBinding =
  | { readonly kind: 'env'; readonly name: string }
  | { readonly kind: 'arg'; readonly flag: string }
  | { readonly kind: 'config'; readonly key: string }
  | { readonly kind: 'session-option'; readonly id: string };

type EffortBinding =
  | { readonly kind: 'env'; readonly name: string }
  | { readonly kind: 'model-bracket' }
  | { readonly kind: 'config'; readonly key: string }
  | { readonly kind: 'session-option'; readonly id: string };

interface Definition {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly configEnv: string | null;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly modelBinding: ModelBinding;
  readonly effortBinding: EffortBinding | null;
  readonly efforts: readonly string[];
  readonly discovery: readonly string[];
  readonly versionProbe: readonly string[];
  readonly harnessKeys: readonly string[];
  readonly skills: SkillsHome;
  readonly profile: ProfileTranslator;
}

const BRIEFED_SKILLS: SkillsHome = {
  directory: '.spotlight/skills',
  readByHarness: false,
};

const CLAUDE_CLI_VERSION = [
  "const { createRequire } = require('node:module');",
  "const { execFileSync } = require('node:child_process');",
  "const { realpathSync } = require('node:fs');",
  "const found = (named) => { for (const each of named) { try { return sdk.resolve(each); } catch {} } return ''; };",
  "const bridge = process.env.CLAUDE_CODE_EXECUTABLE ? '' : realpathSync(execFileSync('sh', ['-c', 'command -v claude-agent-acp']).toString().trim());",
  "const sdk = bridge ? createRequire(createRequire(bridge).resolve('@anthropic-ai/claude-agent-sdk')) : null;",
  "const base = '@anthropic-ai/claude-agent-sdk-' + process.platform + '-' + process.arch;",
  "const musl = process.platform === 'linux' && !process.report?.getReport()?.header?.glibcVersionRuntime;",
  "const named = process.platform === 'linux' ? (musl ? [base + '-musl', base] : [base, base + '-musl']) : [base];",
  "const ext = process.platform === 'win32' ? '.exe' : '';",
  "const cli = process.env.CLAUDE_CODE_EXECUTABLE || found(named.map((each) => each + '/claude' + ext));",
  "process.stdout.write(execFileSync(cli, ['--version']));",
].join('\n');

const CLAUDE_CODE: Definition = {
  id: 'claude-code',
  name: 'Claude Code',
  executable: 'claude-agent-acp',
  args: [],
  configEnv: null,
  modelBinding: { kind: 'env', name: 'ANTHROPIC_MODEL' },
  efforts: EFFORTS,
  effortBinding: { kind: 'env', name: 'CLAUDE_CODE_EFFORT_LEVEL' },
  skills: { directory: '.claude/skills', readByHarness: true },
  discovery: [
    'sh',
    '-c',
    'if [ -n "$ANTHROPIC_API_KEY" ]; then ' +
      'auth="x-api-key: $ANTHROPIC_API_KEY"; ' +
      'else auth="authorization: Bearer $CLAUDE_CODE_OAUTH_TOKEN"; fi; ' +
      'curl -sf https://api.anthropic.com/v1/models ' +
      '-H "$auth" -H "anthropic-version: 2023-06-01" | jq -r ".data[].id"',
  ],
  versionProbe: ['node', '-e', CLAUDE_CLI_VERSION],
  harnessKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
  env: {
    // oxlint-disable-next-line no-template-curly-in-string -- expanded by the runner
    CLAUDE_CONFIG_DIR: '${SPOTLIGHT_STATE_DIR}/claude',
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'none',
    OTEL_LOGS_EXPORTER: 'none',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
    // oxlint-disable-next-line no-template-curly-in-string -- expanded by the runner
    OTEL_EXPORTER_OTLP_ENDPOINT: '${SPOTLIGHT_TELEMETRY_URL}',
    OTEL_TRACES_EXPORT_INTERVAL: '1000',
  },
  profile: claudeCodeProfile,
};

const CURSOR: Definition = {
  id: 'cursor',
  name: 'Cursor CLI',
  executable: 'cursor-agent',
  args: ['acp'],
  env: {},
  configEnv: null,
  modelBinding: { kind: 'arg', flag: '--model' },
  efforts: EFFORTS,
  effortBinding: { kind: 'model-bracket' },
  discovery: ['cursor-agent', 'models'],
  versionProbe: ['cursor-agent', '--version'],
  harnessKeys: ['CURSOR_API_KEY'],
  skills: BRIEFED_SKILLS,
  profile: cursorProfile,
};

const CODEX: Definition = {
  id: 'codex',
  name: 'Codex',
  executable: 'codex-acp',
  args: [],
  env: {
    // oxlint-disable-next-line no-template-curly-in-string -- expanded by the runner
    CODEX_HOME: '${SPOTLIGHT_STATE_DIR}/codex',
  },
  configEnv: 'CODEX_CONFIG',
  modelBinding: { kind: 'config', key: 'model' },
  efforts: EFFORTS,
  effortBinding: { kind: 'config', key: 'model_reasoning_effort' },
  discovery: [
    'sh',
    '-c',
    'curl -sf https://api.openai.com/v1/models ' +
      // oxlint-disable-next-line no-template-curly-in-string -- expanded by the shell
      '-H "authorization: Bearer ${CODEX_API_KEY:-$OPENAI_API_KEY}" | ' +
      'jq -r ".data[].id" | grep -E "^(gpt|o[0-9]|codex)"',
  ],
  versionProbe: ['codex-acp', 'cli', '-V'],
  harnessKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
  skills: BRIEFED_SKILLS,
  profile: codexProfile,
};

const OPENCODE: Definition = {
  id: 'opencode',
  name: 'OpenCode',
  executable: 'opencode',
  args: ['acp'],
  env: {
    // oxlint-disable-next-line no-template-curly-in-string -- expanded by the runner
    OPENCODE_DB: '${SPOTLIGHT_STATE_DIR}/opencode.db',
    OPENCODE_DISABLE_AUTOUPDATE: '1',
  },
  configEnv: 'OPENCODE_CONFIG_CONTENT',
  config: { share: 'disabled', autoupdate: false },
  modelBinding: { kind: 'config', key: 'model' },
  efforts: EFFORTS,
  effortBinding: { kind: 'session-option', id: 'effort' },
  discovery: ['opencode', 'models'],
  versionProbe: ['opencode', '--version'],
  harnessKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY'],
  skills: { directory: '.opencode/skills', readByHarness: true },
  profile: opencodeProfile,
};

const DEFINITIONS: readonly Definition[] = [
  CLAUDE_CODE,
  CURSOR,
  CODEX,
  OPENCODE,
];

const DEFAULT_HARNESS = HarnessId.of(CLAUDE_CODE.id);

const nativeProblem = (
  def: Definition,
  native: unknown,
): HarnessNote | null => {
  if (def.profile.native === 'json') {
    return isObject(native)
      ? null
      : noteOnNative(
          def.id,
          [],
          `is ${def.name}’s own settings, as a JSON object`,
        );
  }

  if (typeof native !== 'string') {
    return noteOnNative(
      def.id,
      [],
      `is ${def.name}’s own config.toml, as text`,
    );
  }

  try {
    parse(native);
    return null;
  } catch (error) {
    return noteOnNative(
      def.id,
      [],
      `is ${def.name}’s own config.toml, and does not read as TOML: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    );
  }
};

@Injectable()
export class BuiltInHarnesses
  implements HarnessLaunchPort, HarnessProfileReviewPort
{
  skillsFor(id: HarnessId): SkillsHome | null {
    return this.definition(id)?.skills ?? null;
  }

  skillHomes(): readonly string[] {
    return [...new Set(DEFINITIONS.map((each) => each.skills.directory))];
  }

  settingFiles(): readonly string[] {
    return DEFINITIONS.flatMap((each) => each.profile.lays);
  }

  commandFor(id: HarnessId, chosen: Chosen): RunCommandShape | null {
    const def = this.definition(id);

    return def ? commandOf(def, chosen, {}).started() : null;
  }

  preparedFor(
    id: HarnessId,
    chosen: Chosen & { readonly profile: ReadyProfileShape | null },
  ): PreparedHarness | null {
    const def = this.definition(id);

    if (!def) {
      return null;
    }

    if (!chosen.profile) {
      return { command: commandOf(def, chosen, {}).started(), setup: null };
    }

    const profile: ReadyProfile = chosen.profile;
    const translated = def.profile.translate(profile);

    return {
      command: commandOf(
        def,
        chosen,
        translated.config,
        translated.env,
      ).started(),
      setup: setupOf(profile, translated),
    };
  }

  readyProfile(shape: HarnessProfileShape): ReadyProfileShape {
    return readyProfile(ProfileKey.of(shape.key), shape);
  }

  review(profile: HarnessProfileShape): ProfileReview {
    const known = new Set(DEFINITIONS.map((each) => each.id));
    const problems: HarnessNote[] = Object.keys(profile.native)
      .filter((harness) => !known.has(harness))
      .map((harness) =>
        noteOnNative(
          harness,
          [],
          `names no harness Spotlight runs; it runs ${[...known].join(', ')}`,
        ),
      );

    for (const def of DEFINITIONS) {
      const native = profile.native[def.id];
      const problem = native === undefined ? null : nativeProblem(def, native);

      if (problem) {
        problems.push(problem);
      }
    }

    return {
      problems,
      warnings:
        problems.length > 0
          ? []
          : DEFINITIONS.flatMap(
              (def) => def.profile.translate(profile).warnings,
            ),
    };
  }

  defaultHarness(): HarnessId {
    return DEFAULT_HARNESS;
  }

  catalogue(): readonly HarnessCatalogueEntry[] {
    return DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      executable: def.executable,
      efforts: def.efforts,
      discovery: def.discovery,
      versionProbe: def.versionProbe,
      harnessKeys: def.harnessKeys,
    }));
  }

  private definition(id: HarnessId): Definition | undefined {
    return DEFINITIONS.find((each) => each.id === id.value);
  }
}

const commandOf = (
  def: Definition,
  chosen: Chosen,
  overrides: Readonly<Record<string, unknown>>,
  extraEnv: Readonly<Record<string, string>> = {},
): HarnessCommand => {
  const args = [...def.args];
  const env: Record<string, string> = { ...def.env, ...extraEnv };
  const config: Record<string, unknown> = { ...def.config };
  const sessionOptions: SessionOption[] = [];

  const value =
    def.effortBinding?.kind === 'model-bracket' && chosen.model && chosen.effort
      ? `${chosen.model.value}[effort=${chosen.effort.value}]`
      : (chosen.model?.value ?? null);

  if (value !== null) {
    if (def.modelBinding.kind === 'env') {
      env[def.modelBinding.name] = value;
    } else if (def.modelBinding.kind === 'arg') {
      args.push(def.modelBinding.flag, value);
    } else if (def.modelBinding.kind === 'session-option') {
      sessionOptions.push({ id: def.modelBinding.id, value });
    } else {
      config[def.modelBinding.key] = value;
    }
  }

  if (def.effortBinding?.kind === 'env' && chosen.effort) {
    env[def.effortBinding.name] = chosen.effort.value;
  }

  if (def.effortBinding?.kind === 'config' && chosen.effort) {
    config[def.effortBinding.key] = chosen.effort.value;
  }

  if (def.effortBinding?.kind === 'session-option' && chosen.effort) {
    sessionOptions.push({
      id: def.effortBinding.id,
      value: chosen.effort.value,
      optional: true,
    });
  }

  const configured = { ...config, ...overrides };

  if (def.configEnv && Object.keys(configured).length > 0) {
    env[def.configEnv] = JSON.stringify(configured);
  }

  return HarnessCommand.of({
    executable: def.executable,
    args,
    env,
    sessionOptions,
  });
};

const ACP_KINDS: Readonly<Record<PermissionKind, readonly string[]>> = {
  read: ['read', 'search'],
  edit: ['edit', 'delete', 'move'],
  execute: ['execute'],
};

const askKindsOf = (profile: HarnessSettings): string[] => [
  ...new Set(
    profile.rules
      .filter((rule) => rule.decision === 'ask')
      .flatMap((rule) => ACP_KINDS[rule.kind]),
  ),
];

const setupOf = (
  profile: HarnessSettings,
  translated: TranslatedProfile,
): PreparedHarness['setup'] => ({
  files: translated.files.map(({ path, text }) => ({ path, text })),
  ...(translated.session ? { session: translated.session } : {}),
  mcpServers: profile.mcpServers.map((server) => ({
    name: server.name,
    command: server.command,
    args: [...server.args],
    env: Object.entries(server.env).map(([name, value]) => ({ name, value })),
  })),
  askKinds: askKindsOf(profile),
});
