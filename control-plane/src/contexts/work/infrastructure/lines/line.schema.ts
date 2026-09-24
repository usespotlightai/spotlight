import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { EFFORTS } from '@work/domain/value-objects/effort.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { REVIEW_STARTS } from '@work/domain/value-objects/review-policy.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { z } from 'zod';

const HAPPENING = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

const identifier = (make: (raw: string) => unknown) =>
  z.string().superRefine((raw, context) => {
    try {
      make(raw);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message:
          error instanceof InvalidIdentifierError
            ? error.because
            : String(error),
      });
    }
  });

const stationSchema = z.object({
  key: identifier(StationKey.of),
  name: z.string().min(1, 'is what this station is called on the board'),
  kind: z.enum(['backlog', 'work', 'completed']).default('work'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'is a six digit hex colour, as in #6d78d5')
    .optional(),
  description: z.string().optional(),
  harness: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(EFFORTS).optional(),
  prompt: z.string().optional(),
  check: z.string().optional(),
  setup: z.string().optional(),
  runners: z.array(z.string()).optional(),
  diffs: z.boolean().optional(),
  decisions: z.boolean().optional(),
  tools: z.array(identifier(Tool.of)).default([]),
  skills: z.array(identifier(SkillKey.of)).default([]),
  passesTo: z.array(identifier(StationKey.of)).default([]),
  ends: z.boolean().default(false),
});

const reactionSchema = z.object({
  happening: z
    .string()
    .regex(HAPPENING, 'names its source first, as in github.checks.failed'),
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

export const lineSchema = z.object({
  key: identifier(LineKey.of),
  name: z.string().min(1, 'is what this line is called'),
  role: identifier(LineRole.of).optional(),
  repositories: z
    .array(z.string().min(1, 'is a repository named owner/name'))
    .default([]),
  stations: z
    .array(stationSchema)
    .min(
      1,
      'is the stations along this line, in order, and there has to be one',
    ),
  reactions: z.array(reactionSchema).default([]),
  reviews: reviewsSchema.optional(),
  runners: z.array(z.string()).optional(),
});

export type LineFields = z.output<typeof lineSchema>;
