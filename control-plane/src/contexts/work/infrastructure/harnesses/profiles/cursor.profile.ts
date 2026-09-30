import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import { planOf, written } from '@work/domain/services/permission-plan';
import type {
  HarnessSettings,
  PermissionKind,
  PermissionRuleParts,
} from '@work/domain/value-objects/ready-profile';
import {
  jsonFile,
  layered,
  nativeObject,
  noteOn,
  noteOnNative,
  type ProfileTranslator,
  type SetupFile,
  type TranslatedProfile,
} from '@work/infrastructure/harnesses/profiles/profile-translator';

const HARNESS = 'cursor';

const CURSOR_SETTINGS = 'cursor/cli-config.json';

const CURSOR_MCP = 'cursor/mcp.json';

const TOKEN: Readonly<Record<PermissionKind, string>> = {
  read: 'Read',
  edit: 'Write',
  execute: 'Shell',
};

const EVERYTHING: Readonly<Record<PermissionKind, string>> = {
  read: 'Read(**)',
  edit: 'Write(**)',
  execute: 'Shell(*)',
};

const commandBase = (pattern: string): string =>
  pattern.trim().split(/\s+/)[0] ?? pattern;

const tokenFor = (
  rule: PermissionRuleParts,
  warnings: HarnessNote[],
): string => {
  const pattern = rule.pattern ?? '';

  if (rule.kind !== 'execute') {
    return `${TOKEN[rule.kind]}(${pattern})`;
  }

  const base = commandBase(pattern);

  if (base !== pattern.trim()) {
    warnings.push(
      noteOn(
        HARNESS,
        rule,
        `Cursor matches a command by its first word, so ${written(rule)} is written Shell(${base}), which covers every ${base} command`,
      ),
    );
  }

  return `Shell(${base})`;
};

export const cursorProfile: ProfileTranslator = {
  native: 'json',
  lays: [CURSOR_SETTINGS, CURSOR_MCP],

  translate(profile: HarnessSettings): TranslatedProfile {
    const allow: string[] = [];
    const deny: string[] = [];
    const warnings: HarnessNote[] = [];

    for (const plan of planOf(profile.rules)) {
      if (plan.otherwise === 'allow') {
        allow.push(EVERYTHING[plan.kind]);
      } else if (plan.otherwise === 'deny') {
        deny.push(EVERYTHING[plan.kind]);
      } else if (plan.kind === 'read' && plan.bare) {
        warnings.push(
          noteOn(
            HARNESS,
            plan.bare,
            'Cursor reads without asking, so read is allowed there',
          ),
        );
      }

      for (const rule of plan.exceptions) {
        if (rule.decision === plan.otherwise) {
          continue;
        }

        if (plan.otherwise === 'deny') {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `Cursor lets a deny rule outrank every allow, so ${written(rule)} is denied there like the rest of ${plan.kind}`,
            ),
          );
          continue;
        }

        if (rule.decision === 'ask') {
          if (plan.otherwise === 'allow') {
            warnings.push(
              noteOn(
                HARNESS,
                rule,
                `Cursor has no ask rules, and cannot ask about part of what it allows, so ${written(rule)} is denied there instead`,
              ),
            );
            deny.push(tokenFor(rule, warnings));
          }
          continue;
        }

        (rule.decision === 'allow' ? allow : deny).push(
          tokenFor(rule, warnings),
        );
      }
    }

    const settings = layered(
      {
        version: 1,
        editor: { vimMode: false },
        permissions: { allow, deny },
      },
      nativeObject(profile, HARNESS),
    );

    for (const path of settings.replaced) {
      if (path[0] === 'permissions') {
        warnings.push(
          noteOnNative(
            HARNESS,
            path,
            `replaces the ${path.join('.')} Spotlight writes from permissions`,
          ),
        );
      }
    }

    const files: SetupFile[] = [jsonFile(CURSOR_SETTINGS, settings.value)];

    if (profile.mcpServers.length > 0) {
      files.push(
        jsonFile(CURSOR_MCP, {
          mcpServers: Object.fromEntries(
            profile.mcpServers.map((server) => [
              server.name,
              {
                command: server.command,
                args: [...server.args],
                env: { ...server.env },
              },
            ]),
          ),
        }),
      );
      warnings.push({
        about: 'mcp-servers',
        harness: HARNESS,
        reason:
          'Cursor reads these from its mcp.json but asks a person to approve each server first, and it cannot ask that over ACP yet, so they may not load there',
      });
    }

    return {
      files,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
      env: { CURSOR_CONFIG_DIR: '${SPOTLIGHT_STATE_DIR}/cursor' },
      config: {},
      session: null,
      warnings,
    };
  },
};
