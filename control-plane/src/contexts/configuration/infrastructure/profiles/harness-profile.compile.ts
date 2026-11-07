import type {
  HarnessProfileCompilerPort,
  ProfileParseResult,
} from '@configuration/application/ports/harness-profile-compiler.port';
import type {
  HarnessReviewPort,
  ReviewNote,
} from '@configuration/application/ports/harness-review.port';
import {
  HARNESS_PROFILES,
  profileAt,
} from '@configuration/application/rendering/harness-profile-problems';
import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
import { HarnessCompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { z } from 'zod';

const rules = z.array(z.string()).default([]);

const profileSchema = z.object({
  key: madeBy(ProfileKey.of),
  permissions: z
    .object({ allow: rules, ask: rules, deny: rules })
    .strict()
    .default({ allow: [], ask: [], deny: [] }),
  mcpServers: z
    .array(
      z
        .object({
          name: z.string(),
          command: z.string(),
          args: z.array(z.string()).default([]),
          env: z.record(z.string(), z.string()).default({}),
        })
        .strict(),
    )
    .default([]),
  native: z.record(z.string(), z.unknown()).default({}),
});

const warningOf = (key: string, note: ReviewNote): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: profileAt(key),
    at: note.at,
    reason: note.reason,
    severity: 'warning',
  });

export class HarnessProfileCompiler implements HarnessProfileCompilerPort {
  constructor(private readonly harnesses: HarnessReviewPort) {}

  parse(input: unknown): ProfileParseResult {
    const read = profileSchema.safeParse(input);

    if (!read.success) {
      return { ok: false, problems: problemsIn(HARNESS_PROFILES, read.error) };
    }

    const definition = read.data;
    let profile: ParsedProfile;

    try {
      profile = {
        key: ProfileKey.of(definition.key),
        settings: ProfileSettings.fromRaw(definition),
      };
    } catch (error) {
      if (error instanceof InvalidHarnessProfileError) {
        return {
          ok: false,
          problems: [
            ConfigurationProblem.of({
              path: profileAt(definition.key),
              at: FieldPath.of(error.field),
              reason: error.because,
            }),
          ],
        };
      }

      throw error;
    }

    return { ok: true, ...profile };
  }

  compatibilityOf(parsed: ParsedProfile): HarnessCompatibility {
    return HarnessCompatibility.of(this.harnesses.review(parsed).problems);
  }

  warningsOf(parsed: ParsedProfile): readonly ConfigurationProblem[] {
    return this.harnesses
      .review(parsed)
      .warnings.map((note) => warningOf(parsed.key.value, note));
  }
}
