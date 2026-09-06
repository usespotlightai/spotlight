import { z } from 'zod';

/**
 * What a person writes in `.spotlight/integrations/*.yml`. Every message here
 * is read by whoever wrote the file, so each says what to do rather than what
 * was expected.
 */

const SOURCE = /^[a-z0-9]+$/;
const HAPPENING = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;
const MARK_KIND = HAPPENING;
const ROLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SECRET = /^[A-Z][A-Z0-9_]{0,63}$/;

/** `${{ ... }}`, which is the one place configuration holds an expression. */
export const EXPRESSION = /^\s*\$\{\{(.+)\}\}\s*$/s;

const expression = z.string().refine((written) => EXPRESSION.test(written), {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: how an expression is written in the file
  message: 'must be an expression, written as ${{ ... }}',
});

const markSchema = z.object({
  kind: z
    .string()
    .regex(MARK_KIND, 'names its source first, as in linear.issue'),
  value: expression,
});

const happeningSchema = z.object({
  happening: z
    .string()
    .regex(HAPPENING, 'names its source first, as in linear.issue.completed'),
  label: z.string().min(1, 'is what a person picking one of these will read'),
  told: z.string().min(1, 'is how this reads in a note when it arrives'),
  /** A person speaking needs what they said; the world reporting does not. */
  spoken: z.boolean().default(false),
  when: expression,
  /** What a task this word opens is called and says, read from the delivery,
   *  and the role of the lines it opens one on. */
  opens: z
    .object({
      onto: z
        .string()
        .regex(ROLE, 'is the role of the lines this opens on, as in delivery'),
      title: expression,
      description: expression.optional(),
    })
    .optional(),
  concerns: z.object({
    branch: expression.optional(),
    marks: z.array(markSchema).default([]),
  }),
});

const verifySchema = z.object(
  {
    scheme: z.literal('hmac-sha256', {
      message:
        'must be hmac-sha256, which is the only scheme Spotlight signs by',
    }),
    header: z.string().min(1, 'is the header the host puts its signature in'),
    secret: z
      .string()
      .regex(
        SECRET,
        'names a secret set on the workspace, as in LINEAR_WEBHOOK_SECRET',
      ),
    encoding: z.enum(['hex', 'base64']).default('hex'),
    /** Some hosts write `sha256=` in front of the digest, and some do not. */
    prefix: z.string().default(''),
  },
  {
    error:
      'says how this host signs its deliveries, and there is no way to say it does not',
  },
);

export const integrationSchema = z.object({
  version: z.literal(1, { message: 'must be 1' }),
  source: z
    .string()
    .regex(SOURCE, 'is the name this host is addressed by, as in linear'),
  name: z.string().min(1).optional(),
  // Deliberately not optional and with no way to say "none": an unsigned
  // endpoint takes anybody's word for what happened, and what happens next
  // is an agent running on it.
  verify: verifySchema,
  delivery: expression.optional(),
  happenings: z
    .array(happeningSchema)
    .min(1, 'is what this host can raise, and there has to be one'),
});

export type IntegrationFile = z.infer<typeof integrationSchema>;
export type HappeningFile = z.infer<typeof happeningSchema>;
export type VerifyFile = z.infer<typeof verifySchema>;

/** The expression inside `${{ ... }}`, which is what CEL is given. */
export const written = (held: string): string => {
  const [, inside] = EXPRESSION.exec(held) ?? [];

  return (inside ?? held).trim();
};
