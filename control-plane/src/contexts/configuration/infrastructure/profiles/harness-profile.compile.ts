import type {
  HarnessProfileCompilerPort,
  ParsedProfile,
} from '@configuration/application/ports/harness-profile-compiler.port';
import type {
  HarnessReviewPort,
  ReviewNote,
} from '@configuration/application/ports/harness-review.port';
import {
  HARNESS_PROFILES,
  profileAt,
} from '@configuration/application/rendering/harness-profile-problems';
import type { ReadProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { InvalidHarnessProfileError } from '@configuration/domain/exceptions/invalid-harness-profile.error';
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

const problemOf = (
  key: string,
  note: ReviewNote,
  severity: 'error' | 'warning',
): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: profileAt(key),
    at: note.at,
    reason: note.reason,
    severity,
  });

export class HarnessProfileCompiler implements HarnessProfileCompilerPort {
  constructor(private readonly harnesses: HarnessReviewPort) {}

  compile(held: unknown): ParsedProfile {
    const read = this.read(held);

    if (!read.ok) {
      return read;
    }

    const problems = this.harnesses
      .review(read)
      .problems.map((note) => problemOf(read.key.value, note, 'error'));

    return problems.length > 0 ? { ok: false, problems } : read;
  }

  read(held: unknown): ParsedProfile {
    const read = profileSchema.safeParse(held);

    if (!read.success) {
      return { ok: false, problems: problemsIn(HARNESS_PROFILES, read.error) };
    }

    const definition = read.data;
    let profile: ReadProfile;

    try {
      profile = {
        key: ProfileKey.of(definition.key),
        settings: ProfileSettings.written(definition),
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

  warningsOf(read: ReadProfile): readonly ConfigurationProblem[] {
    return this.harnesses
      .review(read)
      .warnings.map((note) => problemOf(read.key.value, note, 'warning'));
  }
}
