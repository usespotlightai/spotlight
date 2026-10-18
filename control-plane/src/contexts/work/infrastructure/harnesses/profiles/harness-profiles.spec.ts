import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type {
  HarnessProfileShape,
  PermissionDecisionShape,
  PermissionKindShape,
} from '@work/application/contracts/harness-profile.contract';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { BuiltInHarnesses } from '@work/infrastructure/harnesses/built-in-harnesses';
import { describe, expect, it } from 'vitest';

const harnesses = new BuiltInHarnesses();

const rule = (
  decision: PermissionDecisionShape,
  kind: PermissionKindShape,
  pattern: string | null,
) => ({ decision, kind, pattern });

const profile = (
  over: Partial<HarnessProfileShape> = {},
): HarnessProfileShape => ({
  key: 'careful',
  rules: [],
  mcpServers: [],
  native: {},
  ...over,
});

const prepared = (
  harness: string,
  shape: HarnessProfileShape,
  chosen: { model?: string; effort?: string } = {},
) => {
  const ready = harnesses.preparedFor(HarnessId.of(harness), {
    model: chosen.model ? HarnessModel.of(chosen.model) : null,
    effort: chosen.effort ? Effort.of(chosen.effort) : null,
    profile: { ...shape, key: ProfileKey.of(shape.key), injectedSecrets: [] },
  });

  if (!ready?.setup) {
    throw new Error(`${harness} was not set up`);
  }

  return { ...ready, setup: ready.setup, started: ready.command.started() };
};

const fileAt = (
  setup: { files: readonly { path: string; text: string }[] },
  path: string,
) => setup.files.find((each) => each.path === path)?.text;

const json = (text: string | undefined) => JSON.parse(text ?? 'null');

const PUSHY = profile({ rules: [rule('ask', 'execute', 'git push *')] });

const warned = (shape: HarnessProfileShape, about: string) =>
  harnesses
    .review(shape)
    .warnings.filter((each) => each.reason.includes(about));

const CAREFUL = profile({
  rules: [
    rule('allow', 'execute', 'npm test *'),
    rule('ask', 'execute', null),
    rule('deny', 'read', '.env'),
    rule('deny', 'execute', 'rm -rf *'),
  ],
  mcpServers: [
    {
      name: 'linear',
      command: 'npx',
      args: ['-y', 'linear-mcp'],
      env: { TEAM: 'core' },
    },
  ],
});

describe('one harness profile, told to each harness in its own terms', () => {
  it('sets up Claude Code and Cursor alike from one profile, both asking through Spotlight', () => {
    const claude = prepared('claude-code', CAREFUL);
    const cursor = prepared('cursor', CAREFUL);

    expect(claude.setup.askKinds).toEqual(['execute']);
    expect(cursor.setup.askKinds).toEqual(['execute']);
    expect(claude.setup.mcpServers).toEqual([
      {
        name: 'linear',
        command: 'npx',
        args: ['-y', 'linear-mcp'],
        env: [{ name: 'TEAM', value: 'core' }],
      },
    ]);
    expect(
      json(fileAt(claude.setup, 'claude/settings.json')).permissions.allow,
    ).toContain('Bash(npm test *)');
    expect(
      json(fileAt(cursor.setup, 'cursor/cli-config.json')).permissions.allow,
    ).toContain('Shell(npm)');
  });

  describe('Claude Code', () => {
    it('writes what may be relaxed at user level, and what must apply as managed settings', () => {
      const { setup } = prepared('claude-code', CAREFUL);

      expect(json(fileAt(setup, 'claude/settings.json'))).toEqual({
        permissions: {
          allow: ['Bash(npm test *)', 'mcp__linear'],
          defaultMode: 'acceptEdits',
        },
      });
      expect(setup.session).toEqual({
        claudeCode: {
          options: {
            managedSettings: {
              permissions: {
                ask: [],
                deny: ['Read(.env)', 'Bash(rm -rf *)'],
                disableBypassPermissionsMode: 'disable',
              },
            },
          },
        },
      });
    });

    it('asks about part of what it otherwise allows', () => {
      const { setup } = prepared('claude-code', PUSHY);

      expect(
        json(fileAt(setup, 'claude/settings.json')).permissions.allow,
      ).toEqual(['Bash']);
      expect(
        (
          setup.session as {
            claudeCode: {
              options: { managedSettings: { permissions: { ask: string[] } } };
            };
          }
        ).claudeCode.options.managedSettings.permissions.ask,
      ).toEqual(['Bash(git push *)']);
    });

    it('asks before edits where the profile asks, and allows commands only as listed', () => {
      const { setup } = prepared(
        'claude-code',
        profile({
          rules: [
            rule('ask', 'edit', null),
            rule('ask', 'execute', null),
            rule('allow', 'execute', 'npm test *'),
          ],
        }),
      );

      expect(json(fileAt(setup, 'claude/settings.json')).permissions).toEqual({
        allow: ['Bash(npm test *)'],
        defaultMode: 'default',
      });
    });

    it('passes its native settings through untouched', () => {
      const native = {
        includeCoAuthoredBy: false,
        env: { DISABLE_TELEMETRY: '1' },
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }],
        },
      };
      const { setup } = prepared(
        'claude-code',
        profile({ native: { 'claude-code': native } }),
      );

      expect(json(fileAt(setup, 'claude/settings.json'))).toMatchObject(native);
    });

    it('warns where a native setting replaces what the permissions write', () => {
      expect(
        warned(
          profile({
            native: { 'claude-code': { permissions: { defaultMode: 'plan' } } },
          }),
          'replaces the permissions.defaultMode',
        ),
      ).toHaveLength(1);
    });

    it('warns that a looser rule under a denied kind stays denied', () => {
      const shape = profile({
        rules: [
          rule('deny', 'execute', null),
          rule('allow', 'execute', 'npm test *'),
        ],
      });

      expect(warned(shape, 'Claude Code lets a deny rule outrank')).toEqual([
        expect.objectContaining({
          about: 'rule',
          rule: rule('allow', 'execute', 'npm test *'),
        }),
      ]);
      expect(
        json(
          fileAt(prepared('claude-code', shape).setup, 'claude/settings.json'),
        ).permissions.allow,
      ).toEqual([]);
    });
  });

  describe('Cursor', () => {
    it('keeps its settings in a config directory of the run’s own', () => {
      const { started, setup } = prepared('cursor', CAREFUL);

      expect(started.env?.CURSOR_CONFIG_DIR).toBe(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
        '${SPOTLIGHT_STATE_DIR}/cursor',
      );
      expect(json(fileAt(setup, 'cursor/cli-config.json'))).toEqual({
        version: 1,
        editor: { vimMode: false },
        permissions: {
          allow: ['Read(**)', 'Write(**)', 'Shell(npm)'],
          deny: ['Read(.env)', 'Shell(rm)'],
        },
      });
    });

    it('names the approximation where it cannot ask about part of what it allows', () => {
      expect(warned(PUSHY, 'Cursor has no ask rules')).toEqual([
        expect.objectContaining({
          about: 'rule',
          rule: rule('ask', 'execute', 'git push *'),
        }),
      ]);
      expect(
        json(fileAt(prepared('cursor', PUSHY).setup, 'cursor/cli-config.json'))
          .permissions.deny,
      ).toEqual(['Shell(git)']);
      expect(
        warned(CAREFUL, 'Cursor matches a command by its first word'),
      ).toHaveLength(2);
    });

    it('writes MCP servers where it reads them, and says it may not load them', () => {
      const { setup } = prepared('cursor', CAREFUL);

      expect(json(fileAt(setup, 'cursor/mcp.json'))).toEqual({
        mcpServers: {
          linear: {
            command: 'npx',
            args: ['-y', 'linear-mcp'],
            env: { TEAM: 'core' },
          },
        },
      });
      expect(
        warned(CAREFUL, 'Cursor reads these from its mcp.json'),
      ).toHaveLength(1);
    });
  });

  describe('Codex', () => {
    const TOML = 'model_verbosity = "low"\n\n[tui]\nnotifications = true\n';

    it('writes its native config.toml untouched, and routes approvals to Spotlight through the mode codex-acp runs in', () => {
      const { setup, started } = prepared(
        'codex',
        profile({ ...CAREFUL, native: { codex: TOML } }),
        { model: 'gpt-6-sol', effort: 'high' },
      );

      expect(fileAt(setup, 'codex/config.toml')).toBe(TOML);
      expect(JSON.parse(started.env?.CODEX_CONFIG ?? '{}')).toEqual({
        model: 'gpt-6-sol',
        model_reasoning_effort: 'high',
      });
      expect(started.env?.INITIAL_AGENT_MODE).toBe('read-only');
    });

    it('turns execute patterns into rules by their leading words', () => {
      const { setup } = prepared('codex', CAREFUL);

      expect(fileAt(setup, 'codex/rules/spotlight.rules')).toBe(
        [
          'prefix_rule(pattern=["npm", "test"], decision="allow")',
          'prefix_rule(pattern=["rm", "-rf"], decision="forbidden")',
          '',
        ].join('\n'),
      );
    });

    it('says a read rule does not apply, since its sandbox reads anything', () => {
      expect(
        warned(CAREFUL, 'Codex reads whatever its sandbox can see'),
      ).toEqual([
        expect.objectContaining({
          about: 'rule',
          rule: rule('deny', 'read', '.env'),
        }),
      ]);
    });

    it('says it cannot ask before every command', () => {
      expect(warned(CAREFUL, 'Codex runs commands in its sandbox')).toEqual([
        expect.objectContaining({
          about: 'rule',
          rule: rule('ask', 'execute', null),
        }),
      ]);
    });

    it('says an edit rule does not apply, since codex-acp sets the sandbox on every turn', () => {
      expect(
        warned(
          profile({ rules: [rule('deny', 'edit', null)] }),
          'codex-acp runs every turn in a workspace-write sandbox',
        ),
      ).toEqual([
        expect.objectContaining({
          about: 'rule',
          rule: rule('deny', 'edit', null),
        }),
      ]);
    });

    it('warns that native approval and sandbox settings are replaced per turn', () => {
      expect(
        warned(
          profile({ native: { codex: 'approval_policy = "never"\n' } }),
          'replaced on every turn',
        ),
      ).toEqual([
        expect.objectContaining({
          about: 'native',
          harness: 'codex',
          path: ['approval_policy'],
        }),
      ]);
    });
  });

  describe('OpenCode', () => {
    const configOf = (started: { env?: Readonly<Record<string, string>> }) =>
      JSON.parse(started.env?.OPENCODE_CONFIG_CONTENT ?? '{}');

    it('writes each kind as a permission whose last matching pattern wins, after the rest of the kind', () => {
      const { started, setup } = prepared('opencode', CAREFUL, {
        model: 'anthropic/claude-sonnet-4-5',
      });

      expect(configOf(started)).toEqual({
        share: 'disabled',
        autoupdate: false,
        model: 'anthropic/claude-sonnet-4-5',
        permission: {
          read: { '*': 'allow', '.env': 'deny' },
          glob: 'allow',
          grep: 'allow',
          edit: { '*': 'allow' },
          bash: { '*': 'ask', 'npm test *': 'allow', 'rm -rf *': 'deny' },
        },
      });
      expect(Object.keys(configOf(started).permission.bash)[0]).toBe('*');
      expect(setup.files).toEqual([]);
      expect(setup.askKinds).toEqual(['execute']);
      expect(setup.mcpServers).toHaveLength(1);
    });

    it('lays its native opencode.json over what Spotlight writes, saying what it replaces', () => {
      const { started } = prepared(
        'opencode',
        profile({
          ...CAREFUL,
          native: {
            opencode: {
              instructions: ['STYLE.md'],
              permission: { bash: 'allow' },
            },
          },
        }),
      );

      expect(configOf(started).instructions).toEqual(['STYLE.md']);
      expect(configOf(started).permission.bash).toBe('allow');
      expect(
        warned(
          profile({ native: { opencode: { permission: { bash: 'allow' } } } }),
          'replaces the permission.bash',
        ),
      ).toEqual([
        expect.objectContaining({ about: 'native', harness: 'opencode' }),
      ]);
    });

    it('says a read pattern does not reach its glob and grep searches', () => {
      expect(warned(CAREFUL, 'glob and grep searches')).toEqual([
        expect.objectContaining({
          about: 'rule',
          harness: 'opencode',
          rule: rule('deny', 'read', '.env'),
        }),
      ]);
    });
  });
});

describe('what a harness asks Spotlight about', () => {
  it('is only the kinds of thing a rule the profile puts in ask covers', () => {
    const askKinds = (shape: HarnessProfileShape) =>
      prepared('claude-code', shape).setup.askKinds;

    expect(askKinds(profile())).toEqual([]);
    expect(
      askKinds(profile({ rules: [rule('deny', 'execute', null)] })),
    ).toEqual([]);
    expect(
      askKinds(
        profile({
          rules: [rule('ask', 'read', '.env'), rule('ask', 'edit', null)],
        }),
      ),
    ).toEqual(['read', 'search', 'edit', 'delete', 'move']);
  });
});

describe('reviewing a harness profile', () => {
  it('rejects native settings for a harness Spotlight does not run', () => {
    expect(
      harnesses.review(profile({ native: { aider: {} } })).problems,
    ).toEqual([
      expect.objectContaining({
        about: 'native',
        harness: 'aider',
        path: [],
      }),
    ]);
  });

  it('rejects Codex settings that do not read as TOML', () => {
    expect(
      harnesses.review(profile({ native: { codex: 'model = ' } })).problems,
    ).toEqual([
      expect.objectContaining({
        about: 'native',
        harness: 'codex',
        path: [],
      }),
    ]);
  });

  it('rejects Claude Code settings that are not an object', () => {
    expect(
      harnesses.review(profile({ native: { 'claude-code': 'yes' } })).problems,
    ).toEqual([
      expect.objectContaining({
        about: 'native',
        harness: 'claude-code',
        path: [],
      }),
    ]);
  });

  it('sets nothing up for a station that names no profile', () => {
    expect(
      harnesses.preparedFor(HarnessId.of('claude-code'), {
        model: null,
        effort: null,
        profile: null,
      })?.setup,
    ).toBeNull();
  });

  it('names every setting file a harness may be laid, so a later run can clear it', () => {
    const laid = (
      [
        ['claude-code', { permissions: {} }],
        ['cursor', {}],
        ['codex', 'approval_policy = "on-request"\n'],
      ] as const
    ).flatMap(([harness, native]) =>
      prepared(
        harness,
        profile({
          rules: [
            rule('ask', 'execute', 'git push *'),
            rule('allow', 'execute', 'git status'),
            rule('deny', 'execute', 'rm -rf *'),
          ],
          mcpServers: [
            {
              name: 'linear',
              command: 'npx',
              args: ['-y', 'linear-mcp'],
              env: {},
            },
          ],
          native: { [harness]: native },
        }),
      ).setup.files.map((each) => each.path),
    );

    expect([...laid].sort()).toEqual([...harnesses.settingFiles()].sort());
  });
});
