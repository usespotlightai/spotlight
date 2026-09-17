import {
  TOOL_INPUT_NAME,
  TOOL_INPUT_TYPES,
} from '@integrations/domain/value-objects/offered-tool.vo';
import {
  DOTTED_NAME,
  SECRET_NAME_SHAPE,
  SOURCE_WORD,
  WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import { BINDABLE_TASK_EVENTS } from '@work/application/contracts/bindable-task-events.contract';
import { z } from 'zod';

const NAME = new RegExp(`^${SOURCE_WORD}$`);
const HAPPENING = new RegExp(`^${DOTTED_NAME}$`);
const MARK_KIND = HAPPENING;
const KEY = new RegExp(`^${WORDS}$`);
const SECRET_REF = new RegExp(`^secret\\.${SECRET_NAME_SHAPE}$`);
const WITHIN = /^\d+s$/;

export const EXPRESSION = /^\s*\$\{\{(.+)\}\}\s*$/s;

const expression = z.string().refine((written) => EXPRESSION.test(written), {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: how an expression is written in the file
  message: 'must be an expression, written as ${{ ... }}',
});

const templated = z.string();

const key = (what: string) =>
  z.string().regex(KEY, `is lowercase words joined by dashes, as in ${what}`);

const secretRef = z
  .string()
  .regex(SECRET_REF, 'names a team secret, as in secret.SLACK_BOT_TOKEN');

type HintFile = string | { [field: string]: HintFile };

const hint: z.ZodType<HintFile> = z.lazy(() =>
  z.union([
    z.string().min(1, 'is a type, as in string or list<Issue>'),
    z.record(z.string(), hint),
  ]),
);

const shapeSchema = z.record(z.string(), hint);

const TYPE_NAME = /^[A-Z][A-Za-z0-9]*$/;

const freshnessSchema = z.object({
  at: expression,
  within: z.string().regex(WITHIN, 'is a number of seconds, as in 300s'),
});

const hmacSchema = z.object({
  algorithm: z.enum(['sha256', 'sha1', 'sha512']).default('sha256'),
  secret: secretRef,
  signed: expression.optional(),
  encoding: z.enum(['hex', 'base64']).default('hex'),
  prefix: z.string().default(''),
  header: z.string().optional(),
  freshness: freshnessSchema.optional(),
});

const tokenSchema = z.object({
  secret: secretRef,
  header: z.string().optional(),
  scheme: z.enum(['bearer', 'raw']).default('bearer'),
});

const basicSchema = z.object({
  username: templated,
  password: templated,
});

const oauth2UseSchema = z.object({
  connection: z.literal(true).default(true),
});

const asymmetricSchema = z.object({
  algorithm: z.enum(['ed25519', 'rsa-sha256']),
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

const captureSchema = z.record(z.string(), expression);

const requestSchema = z.object({
  response: shapeSchema.optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  url: templated,
  query: z.record(z.string(), templated).default({}),
  headers: z.record(z.string(), templated).default({}),
  body: z
    .union([templated, z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional(),
  auth: authSchema.optional(),
  expect: z
    .object({
      success: expression.optional(),
      status: z.array(z.number()).optional(),
    })
    .optional(),
  capture: captureSchema.optional(),
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

const toolInputSchema = z.object({
  type: z.enum(TOOL_INPUT_TYPES).default('string'),
  description: z.string().optional(),
  required: z.boolean().default(false),
  default: templated.optional(),
  piped: z.boolean().default(false),
});

const toolSchema = z.object({
  does: key('comment'),
  description: z
    .string()
    .min(1, 'says when an agent should use it, which is how it decides to'),
  inputs: z
    .record(
      z
        .string()
        .regex(
          TOOL_INPUT_NAME,
          'is lowercase words joined by dashes, as in issue',
        ),
      toolInputSchema,
    )
    .default({}),
  output: expression.optional(),
});

const markSchema = z.object({
  kind: z
    .string()
    .regex(MARK_KIND, 'names its source first, as in linear.issue'),
  value: expression,
  find: z.boolean().default(true),
});

const raiseSchema = z.object({
  happening: z
    .string()
    .regex(HAPPENING, 'names its source first, as in slack.app_mention'),
  label: z.string().min(1).optional(),
  told: z.string().min(1).optional(),
  spoken: z.boolean().default(false),
  say: expression.optional(),
  opens: z
    .object({
      onto: z.string().regex(KEY, 'is the role of the lines this opens on'),
      at: key('triage').optional(),
      title: expression,
      description: expression.optional(),
      assignBy: z.object({ email: expression }).optional(),
    })
    .optional(),
  branch: expression.optional(),
  marks: z.array(markSchema).default([]),
  attaches: z
    .object({
      each: expression,
      name: expression,
      type: expression.optional(),
      size: expression.optional(),
      fetch: requestSchema,
    })
    .optional(),
});

const eventSchema = z.object({
  forEach: expression.optional(),
  when: expression,
  lookup: z
    .object({ request: requestSchema, capture: captureSchema })
    .optional(),
  raise: raiseSchema,
});

const webhookSchema = z.object({
  shape: shapeSchema.optional(),
  verify: authSchema,
  respond: z.object({ when: expression, body: expression }).optional(),
  mine: expression.optional(),
  route: z.object({ by: expression }).optional(),
  parse: z.enum(['json', 'form']).default('json'),
  delivery: expression.optional(),
  events: z.array(eventSchema).min(1, 'is what this host can raise'),
});

const pollSchema = z.object({
  shape: shapeSchema.optional(),
  every: z.string().regex(WITHIN, 'is a number of seconds, as in 60s'),
  request: requestSchema,
  cursor: expression.optional(),
  events: z.array(eventSchema).min(1),
});

const scheduleSchema = z.object({
  cron: z.string().min(1),
  do: key('post-message'),
});

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

export const ON_EVENTS = BINDABLE_TASK_EVENTS;

export const integrationSchema = z
  .object({
    version: z.literal(1, { message: 'must be 1' }),
    integration: z
      .string()
      .regex(NAME, 'is the name this host is addressed by, as in slack'),
    name: z.string().min(1).optional(),
    types: z
      .record(
        z.string().regex(TYPE_NAME, 'is named in capitals, as in Issue'),
        shapeSchema,
      )
      .default({}),
    connection: connectionSchema.optional(),
    webhook: webhookSchema.optional(),
    poll: pollSchema.optional(),
    schedule: scheduleSchema.optional(),
    actions: z.record(key('post-message'), actionSchema).default({}),
    tools: z.record(key('comment'), toolSchema).default({}),
    on: z
      .record(
        z.string(),
        z.object({
          do: key('post-message'),
          to: z.record(z.string(), expression).default({}),
          routes: z.record(z.string(), z.string()).default({}),
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

export type EventFile = z.infer<typeof eventSchema>;
export type AuthFile = z.infer<typeof authSchema>;
export type RequestFile = z.infer<typeof requestSchema>;
export type RaiseFile = z.infer<typeof raiseSchema>;

export const written = (held: string): string => {
  const [, inside] = EXPRESSION.exec(held) ?? [];

  return (inside ?? held).trim();
};

export const isExpression = (held: string): boolean => EXPRESSION.test(held);

export const secretOf = (reference: string): string =>
  reference.slice('secret.'.length);
