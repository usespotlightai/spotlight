import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import { planOf, written } from '@work/domain/services/permission-plan';
import type {
  HarnessSettings,
  PermissionDecision,
  PermissionKind,
} from '@work/domain/value-objects/ready-profile';
import {
  layered,
  nativeObject,
  noteOn,
  noteOnNative,
  type ProfileTranslator,
  type TranslatedProfile,
} from '@work/infrastructure/harnesses/profiles/profile-translator';

const HARNESS = 'opencode';

const TOOL: Readonly<Record<PermissionKind, string>> = {
  read: 'read',
  edit: 'edit',
  execute: 'bash',
};

const SEARCHES = ['glob', 'grep'] as const;

export const opencodeProfile: ProfileTranslator = {
  native: 'json',
  lays: [],

  translate(profile: HarnessSettings): TranslatedProfile {
    const permission: Record<
      string,
      PermissionDecision | Record<string, PermissionDecision>
    > = {};
    const warnings: HarnessNote[] = [];

    for (const plan of planOf(profile.rules)) {
      const rules: Record<string, PermissionDecision> = {
        '*': plan.otherwise,
      };

      for (const rule of plan.exceptions) {
        if (rule.pattern !== null) {
          rules[rule.pattern] = rule.decision;
        }
      }

      permission[TOOL[plan.kind]] = rules;

      if (plan.kind === 'read') {
        for (const search of SEARCHES) {
          permission[search] = plan.otherwise;
        }

        for (const rule of plan.exceptions) {
          if (rule.decision !== plan.otherwise) {
            warnings.push(
              noteOn(
                HARNESS,
                rule,
                `OpenCode checks a path only when it reads a file, so ${written(rule)} does not apply to its glob and grep searches, which follow the rest of read`,
              ),
            );
          }
        }
      }
    }

    const config = layered({ permission }, nativeObject(profile, HARNESS));

    for (const path of config.replaced) {
      warnings.push(
        noteOnNative(
          HARNESS,
          path,
          `replaces the ${path.join('.')} Spotlight writes from permissions`,
        ),
      );
    }

    return {
      files: [],
      env: {},
      config: config.value,
      session: null,
      warnings,
    };
  },
};
