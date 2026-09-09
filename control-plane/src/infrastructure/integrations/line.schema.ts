import { z } from 'zod';

/**
 * What a person writes in `.spotlight/lines/*.yml`: a line, the stations
 * along it, and what a word from outside does to a task standing at one.
 *
 * Every message here is read by whoever wrote the file, so each says what to
 * do rather than what was expected.
 */

const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HAPPENING = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

const key = (what: string) =>
  z.string().regex(KEY, `is lowercase words joined by dashes, as in ${what}`);

const stationSchema = z.object({
  key: key('code-review'),
  name: z.string().min(1, 'is what this station is called on the board'),
  kind: z.enum(['backlog', 'work', 'completed']).default('work'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'is a six digit hex colour, as in #6d78d5')
    .optional(),
  description: z.string().optional(),
  /** Which harness works here. Nothing runs at a backlog or at the end. */
  harness: z.string().min(1).optional(),
  prompt: z.string().optional(),
  tools: z.array(z.string().min(1)).default([]),
  /** Where work may go from here, by station key. */
  passesTo: z.array(key('code-review')).default([]),
  /** Whether finishing here finishes the task. */
  ends: z.boolean().default(false),
});

const reactionSchema = z.object({
  happening: z
    .string()
    .regex(HAPPENING, 'names its source first, as in github.checks.failed'),
  /** Where the task must be standing. Left out, it applies wherever it is. */
  from: key('code-review').optional(),
  to: key('code-review'),
});

export const lineSchema = z.object({
  version: z.literal(1, { message: 'must be 1' }),
  key: key('delivery'),
  name: z.string().min(1, 'is what this line is called'),
  /** What the line is for, so the factory can route work to it by purpose. */
  role: key('improvement').optional(),
  /** The repositories a run on this line works in, each as owner/name. */
  repositories: z
    .array(z.string().min(1, 'is a repository named owner/name'))
    .default([]),
  stations: z
    .array(stationSchema)
    .min(1, 'is the stations along this line, and there has to be one'),
  reactions: z.array(reactionSchema).default([]),
});

export type LineFile = z.infer<typeof lineSchema>;
export type StationFile = z.infer<typeof stationSchema>;
export type ReactionFile = z.infer<typeof reactionSchema>;
