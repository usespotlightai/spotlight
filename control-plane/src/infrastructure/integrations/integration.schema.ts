import { z } from 'zod';

/**
 * What a person writes in `.spotlight/integrations/*.yml`. One schema fits every
 * host: an integration composes generic primitives — a trigger (webhook, and
 * later polling or a schedule), an auth, generic HTTP `actions`, and `on`
 * bindings from Spotlight's own events to those actions. Adding a host is
 * writing one of these files; it is never editing TypeScript.
 *
 * Every message here is read by whoever wrote the file, so each says what to do
 * rather than what was expected.
 */

const NAME = /^[a-z0-9]+$/;
const HAPPENING = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;
const MARK_KIND = HAPPENING;
const ROLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SECRET_REF = /^secret\.[A-Z][A-Z0-9_]{0,63}$/;
const WITHIN = /^\d+s$/;

/** `${{ ... }}`, which is the one place configuration holds an expression. */
export const EXPRESSION = /^\s*\$\{\{(.+)\}\}\s*$/s;

const expression = z.string().refine((written) => EXPRESSION.test(written), {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: how an expression is written in the file
  message: 'must be an expression, written as ${{ ... }}',
});

/** A value that may be a literal or an expression; the compiler tells them apart. */
const templated = z.string();

const key = (what: string) =>
  z.string().regex(KEY, `is lowercase words joined by dashes, as in ${what}`);

/** A reference to a team secret, written `secret.NAME`, never the value. */
const secretRef = z
  .string()
  .regex(SECRET_REF, 'names a team secret, as in secret.SLACK_BOT_TOKEN');

// ── Auth: one shape, usable to verify an inbound delivery and to sign an
// outbound request. Exactly one kind is named. ─────────────────────────────

const freshnessSchema = z.object({
  at: expression,
  within: z.string().regex(WITHIN, 'is a number of seconds, as in 300s'),
});

const hmacSchema = z.object({
  algorithm: z.enum(['sha256', 'sha1', 'sha512']).default('sha256'),
  secret: secretRef,
  /** The string that is signed. Defaults to the body as it arrived. */
  signed: expression.optional(),
  encoding: z.enum(['hex', 'base64']).default('hex'),
  prefix: z.string().default(''),
  header: z.string().optional(),
  freshness: freshnessSchema.optional(),
});

const tokenSchema = z.object({
  secret: secretRef,
  /** Where the token goes: a header (default Authorization) with a scheme. */
  header: z.string().optional(),
  scheme: z.enum(['bearer', 'raw']).default('bearer'),
});

const basicSchema = z.object({
  username: templated,
  password: templated,
});

/** Uses the token stored for the workspace's connection to this host. */
const oauth2UseSchema = z.object({
  connection: z.literal(true).default(true),
});

const asymmetricSchema = z.object({
  algorithm: z.enum(['ed25519', 'rsa-sha256']),
  /** The public key: hex for ed25519, PEM for rsa-sha256. Public, so it may
   *  sit inline in the file. */
  key: templated,
  signed: expression.optional(),
  encoding: z.enum(['hex', 'base64']).default('hex'),
  header: z.string().optional(),
  freshness: freshnessSchema.optional(),
});

const jwtSchema = z.object({
  jwks: z.string().url(),
  header: z.string().optional(),
  audience: z.string().optional(),
  issuer: z.string().optional(),
});

const authSchema = z
  .object({
    hmac: hmacSchema.optional(),
    token: tokenSchema.optional(),
    basic: basicSchema.optional(),
    oauth2: oauth2UseSchema.optional(),
    asymmetric: asymmetricSchema.optional(),
    jwt: jwtSchema.optional(),
  })
  .refine(
    (auth) =>
      Object.values(auth).filter((each) => each !== undefined).length === 1,
    'names exactly one way to authenticate',
  );

// ── Requests & actions: the generic HTTP primitive. ────────────────────────

const captureSchema = z.record(z.string(), expression);

const requestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  url: templated,
  query: z.record(z.string(), templated).default({}),
  headers: z.record(z.string(), templated).default({}),
  body: templated.optional(),
  auth: authSchema.optional(),
  expect: z
    .object({
      success: expression.optional(),
      status: z.array(z.number()).optional(),
    })
    .optional(),
  capture: captureSchema.optional(),
  // Protocol knobs, added as generic primitives when a host first needs one.
  retry: z
    .object({
      times: z.number().int().min(0).default(0),
      backoff: z.string().optional(),
    })
    .optional(),
  paginate: z.object({ cursor: expression, until: expression }).optional(),
});

const actionSchema = z.object({
  request: requestSchema,
});

// ── Webhook trigger. ───────────────────────────────────────────────────────

const markSchema = z.object({
  kind: z
    .string()
    .regex(MARK_KIND, 'names its source first, as in linear.issue'),
  value: expression,
});

const raiseSchema = z.object({
  happening: z
    .string()
    .regex(HAPPENING, 'names its source first, as in slack.app_mention'),
  label: z.string().min(1).optional(),
  told: z.string().min(1).optional(),
  spoken: z.boolean().default(false),
  opens: z
    .object({
      onto: z.string().regex(ROLE, 'is the role of the lines this opens on'),
      at: key('triage').optional(),
      title: expression,
      description: expression.optional(),
      /** Assign the opened task to the member with this email, where one matches. */
      assignBy: z.object({ email: expression }).optional(),
    })
    .optional(),
  branch: expression.optional(),
  marks: z.array(markSchema).default([]),
});

const eventSchema = z.object({
  /** A list to raise one word per item of; each is bound as `item`. */
  forEach: expression.optional(),
  when: expression,
  /**
   * A call made before the word is raised, whose captures join the bindings —
   * for reading what a delivery only names, such as the email behind a user id.
   */
  lookup: z
    .object({ request: requestSchema, capture: captureSchema })
    .optional(),
  raise: raiseSchema,
});

const webhookSchema = z.object({
  verify: authSchema,
  /** A handshake some hosts make before they will send: echoed synchronously. */
  respond: z.object({ when: expression, body: expression }).optional(),
  /** A delivery the host recognises as Spotlight's own doing. */
  mine: expression.optional(),
  /** Where a shared-door delivery says whose workspace it is. */
  route: z.object({ by: expression }).optional(),
  parse: z.enum(['json', 'form']).default('json'),
  /** Names a delivery so the same one twice is worked once. */
  delivery: expression.optional(),
  events: z.array(eventSchema).min(1, 'is what this host can raise'),
});

// ── Poll & schedule triggers (structure now; runtime added incrementally). ──

const pollSchema = z.object({
  every: z.string().regex(WITHIN, 'is a number of seconds, as in 60s'),
  request: requestSchema,
  cursor: expression.optional(),
  events: z.array(eventSchema).min(1),
});

const scheduleSchema = z.object({
  cron: z.string().min(1),
  do: key('post-message'),
});

// ── Connection: how a workspace links to the host. ─────────────────────────

const connectionSchema = z.object({
  oauth2: z
    .object({
      authorize: z.string().url(),
      token: z.string().url(),
      scopes: z.array(z.string()).default([]),
      identity: expression.optional(),
    })
    .optional(),
  manual: z.object({ secrets: z.array(secretRef).default([]) }).optional(),
});

// ── The file. ──────────────────────────────────────────────────────────────

export const ON_EVENTS = ['task.asked'] as const;

export const integrationSchema = z
  .object({
    version: z.literal(1, { message: 'must be 1' }),
    integration: z
      .string()
      .regex(NAME, 'is the name this host is addressed by, as in slack'),
    name: z.string().min(1).optional(),
    connection: connectionSchema.optional(),
    webhook: webhookSchema.optional(),
    poll: pollSchema.optional(),
    schedule: scheduleSchema.optional(),
    actions: z.record(key('post-message'), actionSchema).default({}),
    on: z
      .record(
        z.string(),
        z.object({
          do: key('post-message'),
          /** The target, read from the task's existing marks (an origin thread). */
          to: z.record(z.string(), expression).default({}),
          /** A fallback `to.channel` by the task's line key, where it has none. */
          routes: z.record(z.string(), z.string()).default({}),
          /** Handles to wear on the task from what the action captured. */
          mark: z.array(markSchema).default([]),
        }),
      )
      .default({}),
  })
  .refine(
    (file) =>
      file.webhook ||
      file.poll ||
      file.schedule ||
      Object.keys(file.actions).length > 0 ||
      Object.keys(file.on).length > 0,
    'must do something: a webhook, a poll, a schedule, or an action to run',
  );

export type IntegrationFile = z.infer<typeof integrationSchema>;
export type WebhookFile = z.infer<typeof webhookSchema>;
export type EventFile = z.infer<typeof eventSchema>;
export type AuthFile = z.infer<typeof authSchema>;
export type RequestFile = z.infer<typeof requestSchema>;
export type RaiseFile = z.infer<typeof raiseSchema>;

/** The expression inside `${{ ... }}`, which is what CEL is given. */
export const written = (held: string): string => {
  const [, inside] = EXPRESSION.exec(held) ?? [];

  return (inside ?? held).trim();
};

/** Whether a templated value is an expression rather than a plain literal. */
export const isExpression = (held: string): boolean => EXPRESSION.test(held);

/** The secret a `secret.NAME` reference names. */
export const secretOf = (reference: string): string =>
  reference.slice('secret.'.length);
