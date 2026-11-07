import { STATION_KINDS } from '@lines/domain/entities/station.entity';
import { REVIEW_STARTS } from '@lines/domain/value-objects/review-policy.vo';
import { SEARCH_OBJECTIVES } from '@lines/domain/value-objects/search-policy.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { refusalOf } from '@lines/infrastructure/lines/definition-errors';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { EFFORTS } from '@shared-kernel/domain/value-objects/effort.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { z } from 'zod';

const identifier = (make: (raw: string) => unknown, refused?: string) =>
  z.string().superRefine((raw, context) => {
    try {
      make(raw);
    } catch (error) {
      const refusal = refusalOf(error);

      context.addIssue({
        code: 'custom',
        message:
          refused ??
          (refusal instanceof InvalidIdentifierError
            ? refusal.because
            : refusal.message),
      });
    }
  });

const judgeSchema = z.object({
  rubric: z.string().optional(),
  claims: z.array(z.string()).optional(),
  passThreshold: z.number().optional(),
  sample: z.number(),
  minAgreement: z.number(),
});

const alertSchema = z.object({
  measure: z.string(),
  risesBy: z.number().optional(),
  above: z.number().optional(),
  fallsBy: z.number().optional(),
  below: z.number().optional(),
  over: z.number(),
});

const stationSearchSchema = z.object({
  enabled: z.boolean().optional(),
  ceiling: z.number().optional(),
  period: z.string().optional(),
  onAlert: z.boolean().optional(),
  cooldown: z.string().optional(),
  agent: z
    .object({
      harness: z.string(),
      model: z.string().optional(),
      effort: z.enum(EFFORTS).optional(),
    })
    .optional(),
  iterations: z.number().optional(),
  repeats: z.number().optional(),
  objective: z.enum(SEARCH_OBJECTIVES).optional(),
});

const stationSchema = z.object({
  key: identifier(StationKey.of),
  name: z.string().min(1, 'is what this station is called on the board'),
  kind: z.enum(STATION_KINDS).default('work'),
  color: identifier(
    StationColor.of,
    'is a six digit hex colour, as in #6d78d5',
  ).optional(),
  description: z.string().optional(),
  harness: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(EFFORTS).optional(),
  profile: identifier(ProfileKey.of).optional(),
  prompt: z.string().optional(),
  check: z.string().optional(),
  runners: z.array(z.string()).optional(),
  diffs: z.boolean().optional(),
  decisions: z.boolean().optional(),
  memories: z.boolean().optional(),
  judge: judgeSchema.optional(),
  alerts: z.array(alertSchema).default([]),
  search: stationSearchSchema.optional(),
  tools: z.array(identifier(Tool.of)).default([]),
  skills: z.array(identifier(SkillKey.of)).default([]),
  passesTo: z.array(identifier(StationKey.of)).default([]),
  ends: z.boolean().default(false),
});

const repositorySchema = z.object({
  name: z.string().min(1, 'is a repository named owner/name'),
  image: z.string().optional(),
  setup: z.string().optional(),
});

const reactionSchema = z.object({
  happening: identifier(
    Happening.of,
    'names its integration first, as in github.checks.failed',
  ),
  from: identifier(StationKey.of).optional(),
  to: identifier(StationKey.of),
});

const reviewsSchema = z.object({
  start: z
    .enum(REVIEW_STARTS, {
      message:
        'is opened, to review every pull request as it opens, or mentioned, to review one when Spotlight is mentioned on it',
    })
    .optional(),
  mention: z.string().optional(),
  label: z.string().optional(),
  skip: z
    .object({
      spotlight: z.boolean().optional(),
      drafts: z.boolean().optional(),
      authors: z
        .array(z.string().min(1, 'is a GitHub login, as in dependabot[bot]'))
        .optional(),
    })
    .default({}),
});

const replayCheckSchema = z.object({
  maxRegressions: z.number().optional(),
  ceiling: z.number().optional(),
  currency: z.string().optional(),
  minGain: z.number().optional(),
});

const lineSearchSchema = z.object({
  enabled: z.boolean().optional(),
  monthlyCeiling: z.number().optional(),
  currency: z.string().optional(),
  ceiling: z.number().optional(),
  period: z.string().optional(),
  onAlert: z.boolean().optional(),
  cooldown: z.string().optional(),
});

const sourceSchema = z.object({
  repository: z.string(),
  path: z.string(),
});

export const lineSchema = z.object({
  key: identifier(LineKey.of),
  name: z.string().min(1, 'is what this line is called'),
  role: identifier(LineRole.of).optional(),
  repositories: z.array(repositorySchema).default([]),
  stations: z
    .array(stationSchema)
    .min(
      1,
      'is the stations along this line, in order, and there has to be one',
    ),
  reactions: z.array(reactionSchema).default([]),
  reviews: reviewsSchema.optional(),
  replayCheck: replayCheckSchema.optional(),
  search: lineSearchSchema.optional(),
  source: z.preprocess(
    (source) => source ?? undefined,
    sourceSchema.optional(),
  ),
  runners: z.array(z.string()).optional(),
});

export type LineFields = z.output<typeof lineSchema>;
