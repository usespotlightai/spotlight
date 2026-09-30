import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import {
  planOf,
  stricter,
  written,
} from '@work/domain/services/permission-plan';
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
  type TranslatedProfile,
} from '@work/infrastructure/harnesses/profiles/profile-translator';

const HARNESS = 'claude-code';

const CLAUDE_SETTINGS = 'claude/settings.json';

const TOOL: Readonly<Record<PermissionKind, string>> = {
  read: 'Read',
  edit: 'Edit',
  execute: 'Bash',
};

const ruleFor = (rule: PermissionRuleParts): string =>
  rule.pattern === null
    ? TOOL[rule.kind]
    : `${TOOL[rule.kind]}(${rule.pattern})`;

interface Lists {
  readonly allow: string[];
  readonly ask: string[];
  readonly deny: string[];
}

const byDefault = (
  kind: PermissionKind,
  lists: Lists,
  rule: PermissionRuleParts,
) => {
  if (rule.decision === 'deny') {
    lists.deny.push(TOOL[kind]);
  } else if (rule.decision === 'ask' && kind === 'read') {
    lists.ask.push(TOOL[kind]);
  } else if (rule.decision === 'allow' && kind === 'execute') {
    lists.allow.push(TOOL[kind]);
  }
};

export const claudeCodeProfile: ProfileTranslator = {
  native: 'json',
  lays: [CLAUDE_SETTINGS],

  translate(profile: HarnessSettings): TranslatedProfile {
    const lists: Lists = { allow: [], ask: [], deny: [] };
    const warnings: HarnessNote[] = [];
    let acceptsEdits = true;

    for (const plan of planOf(profile.rules)) {
      if (plan.bare) {
        byDefault(plan.kind, lists, plan.bare);
      } else if (plan.kind === 'execute') {
        lists.allow.push(TOOL.execute);
      }

      if (plan.kind === 'edit' && plan.otherwise !== 'allow') {
        acceptsEdits = false;
      }

      for (const rule of plan.exceptions) {
        if (rule.decision === plan.otherwise) {
          continue;
        }

        const heldByRule =
          plan.otherwise === 'deny' ||
          (plan.otherwise === 'ask' && plan.kind === 'read');

        if (!stricter(rule.decision, plan.otherwise) && heldByRule) {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `Claude Code lets a ${plan.otherwise} rule outrank every looser one, so ${written(rule)} is ${plan.otherwise === 'deny' ? 'denied' : 'asked about'} there like the rest of ${plan.kind}`,
            ),
          );
          continue;
        }

        lists[rule.decision].push(ruleFor(rule));
      }
    }

    for (const server of profile.mcpServers) {
      lists.allow.push(`mcp__${server.name}`);
    }

    const common = {
      permissions: {
        allow: lists.allow,
        defaultMode: acceptsEdits ? 'acceptEdits' : 'default',
      },
    };
    const settings = layered(common, nativeObject(profile, HARNESS));

    for (const path of settings.replaced) {
      warnings.push(
        noteOnNative(
          HARNESS,
          path,
          `replaces the ${path.join('.')} Spotlight writes from permissions`,
        ),
      );
    }

    return {
      files: [jsonFile(CLAUDE_SETTINGS, settings.value)],
      env: {},
      config: {},
      session: {
        claudeCode: {
          options: {
            managedSettings: {
              permissions: {
                ask: lists.ask,
                deny: lists.deny,
                disableBypassPermissionsMode: 'disable',
              },
            },
          },
        },
      },
      warnings,
    };
  },
};
