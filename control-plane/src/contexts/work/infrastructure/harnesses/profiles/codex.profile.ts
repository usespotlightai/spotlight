import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import { planOf, written } from '@work/domain/services/permission-plan';
import type {
  HarnessSettings,
  PermissionDecision,
  PermissionRuleParts,
} from '@work/domain/value-objects/ready-profile';
import {
  noteOn,
  noteOnNative,
  type ProfileTranslator,
  type SetupFile,
  type TranslatedProfile,
} from '@work/infrastructure/harnesses/profiles/profile-translator';
import { parse } from 'smol-toml';

const HARNESS = 'codex';

const CODEX_CONFIG_FILE = 'codex/config.toml';

const CODEX_RULES_FILE = 'codex/rules/spotlight.rules';

const SET_PER_TURN = [
  'approval_policy',
  'approvals_reviewer',
  'sandbox_mode',
] as const;

const DECISION: Readonly<Record<PermissionDecision, string>> = {
  allow: 'allow',
  ask: 'prompt',
  deny: 'forbidden',
};

const WILD = /[*?[\]]/;

const prefixOf = (
  rule: PermissionRuleParts,
): { tokens: readonly string[]; cut: boolean } => {
  const words = (rule.pattern ?? '').trim().split(/\s+/).filter(Boolean);
  const trailing = words[words.length - 1] === '*' ? words.slice(0, -1) : words;
  const wild = trailing.findIndex((word) => WILD.test(word));

  return wild < 0
    ? { tokens: trailing, cut: false }
    : { tokens: trailing.slice(0, wild), cut: true };
};

const starlark = (value: string): string => JSON.stringify(value);

const nativeKeys = (profile: HarnessSettings): Record<string, unknown> => {
  const given = profile.native[HARNESS];

  if (typeof given !== 'string') {
    return {};
  }

  try {
    return parse(given);
  } catch {
    return {};
  }
};

export const codexProfile: ProfileTranslator = {
  native: 'toml',
  lays: [CODEX_CONFIG_FILE, CODEX_RULES_FILE],

  translate(profile: HarnessSettings): TranslatedProfile {
    const warnings: HarnessNote[] = [];
    const rules: string[] = [];

    for (const plan of planOf(profile.rules)) {
      if (plan.kind === 'read') {
        for (const rule of [
          ...(plan.bare && plan.otherwise !== 'allow' ? [plan.bare] : []),
          ...plan.exceptions.filter((each) => each.decision !== 'allow'),
        ]) {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `Codex reads whatever its sandbox can see, so ${written(rule)} does not apply there`,
            ),
          );
        }
        continue;
      }

      if (plan.kind === 'edit') {
        for (const rule of [
          ...(plan.bare && plan.otherwise !== 'allow' ? [plan.bare] : []),
          ...plan.exceptions,
        ]) {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `codex-acp runs every turn in a workspace-write sandbox, deciding edits by that sandbox rather than by rule, so ${written(rule)} does not apply there`,
            ),
          );
        }
        continue;
      }

      if (plan.bare && plan.otherwise !== 'allow') {
        warnings.push(
          noteOn(
            HARNESS,
            plan.bare,
            `Codex runs commands in its sandbox without asking unless a rule names them, so ${written(plan.bare)} does not apply there. Only execute rules with a pattern apply`,
          ),
        );
      }

      for (const rule of plan.exceptions) {
        const prefix = prefixOf(rule);

        if (prefix.tokens.length === 0) {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `Codex rules match a command by its leading words, and ${written(rule)} starts with a wildcard, so it is left out there`,
            ),
          );
          continue;
        }

        if (prefix.cut) {
          warnings.push(
            noteOn(
              HARNESS,
              rule,
              `Codex rules match a command by its leading words, so ${written(rule)} is written as every command starting ${prefix.tokens.join(' ')}`,
            ),
          );
        }

        rules.push(
          `prefix_rule(pattern=[${prefix.tokens.map(starlark).join(', ')}], decision=${starlark(DECISION[rule.decision])})`,
        );
      }
    }

    const native = profile.native[HARNESS];
    const setKeys = nativeKeys(profile);

    for (const key of SET_PER_TURN) {
      if (key in setKeys) {
        warnings.push(
          noteOnNative(
            HARNESS,
            [key],
            'is replaced on every turn by the mode codex-acp runs in, which Spotlight sets so approvals come to it',
          ),
        );
      }
    }

    const files: SetupFile[] = [
      ...(typeof native === 'string'
        ? [{ path: CODEX_CONFIG_FILE, text: native }]
        : []),
      ...(rules.length > 0
        ? [{ path: CODEX_RULES_FILE, text: `${rules.join('\n')}\n` }]
        : []),
    ];

    return {
      files,
      env: { INITIAL_AGENT_MODE: 'read-only' },
      config: {},
      session: null,
      warnings,
    };
  },
};
