import { TOOL_INPUT_NAME } from '@integrations/domain/value-objects/offered-tool.vo';
import {
  CATALOG_SOURCE,
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
export const SECRET_REF = new RegExp(`^secret\\.${SECRET_NAME_SHAPE}$`);
const WITHIN = /^\d+s$/;

const EXPRESSION = /^\s*\$\{\{(.+)\}\}\s*$/s;

const expression = z.string().refine((written) => EXPRESSION.test(written), {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: how an expression is written in the file
  message: 'must be an expression, written as ${{ ... }}',
});

const templated = z.string();

const key = (what: string) =>
  z.string().regex(KEY, `is lowercase words joined by dashes, as in ${what}`);

const secretRef = z
  .string()
  .regex(SECRET_REF, 'names a workspace secret, as in secret.SLACK_BOT_TOKEN');

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

const authOptions = z.object({
  hmac: hmacSchema.optional(),
  token: tokenSchema.optional(),
  oauth2: oauth2UseSchema.optional(),
  asymmetric: asymmetricSchema.optional(),
  jwt: jwtSchema.optional(),
  secrets: z
    .array(secretRef)
    .min(1, 'names each secret the request wears, as in secret.LINEAR_API_KEY')
    .optional(),
});

type AuthOptions = z.infer<typeof authOptions>;

const namesOne = (auth: AuthOptions): boolean =>
  Object.values(auth).filter((each) => each !== undefined).length === 1;

const verifySchema = authOptions
  .refine(namesOne, 'names exactly one way to authenticate')
  .refine(
    (auth) => !auth.oauth2 && !auth.secrets,
    'verifies a delivery by hmac, token, asymmetric or jwt',
  );

const requestAuthSchema = authOptions
  .refine(namesOne, 'names exactly one way to authenticate')
  .refine(
    (auth) => auth.oauth2 !== undefined || auth.secrets !== undefined,
    'authenticates a request by its oauth2 connection, or by the secrets it wears toward the hosts they are bound to',
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
  auth: requestAuthSchema.optional(),
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
});

const actionSchema = z.object({
  request: requestSchema,
});

const SCALAR_INPUT_TYPES = ['string', 'number', 'integer', 'boolean'] as const;

const toolInputSchema = z
  .object({
    type: z.enum(SCALAR_INPUT_TYPES).optional(),
    schema: z.record(z.string(), z.unknown()).optional(),
    description: z.string().optional(),
    required: z.boolean().default(false),
    default: templated.optional(),
    piped: z.boolean().default(false),
  })
  .refine(
    (input) => input.type === undefined || input.schema === undefined,
    'takes a type, or a JSON Schema as its schema, but not both',
  );

const approvalSchema = z.object({
  because: z
    .string()
    .min(
      1,
      'says why a person has to approve it, which is what they are shown before they decide',
    ),
});

const toolSchema = z.object({
  does: key('comment'),
  approval: approvalSchema.optional(),
  description: z
    .string()
    .min(1, 'says when an agent should use it, which is how it decides to'),
  inputs: z
    .record(
      z
        .string()
        .regex(
          TOOL_INPUT_NAME,
          'is letters, digits, dashes and underscores, as in issue or team_id',
        ),
      toolInputSchema,
    )
    .default({}),
  output: expression.optional(),
});

const approvalOverrideSchema = z.union([approvalSchema, z.literal(false)]);

const describedToolsSchema = z
  .object({
    include: z.array(z.string().min(1)).default([]),
    exclude: z.array(z.string().min(1)).default([]),
    approval: z.record(key('delete-pet'), approvalOverrideSchema).default({}),
  })
  .default({ include: [], exclude: [], approval: {} });

const openapiSchema = z
  .object({
    url: z.string().url().optional(),
    document: z.record(z.string(), z.unknown()).optional(),
    baseUrl: z.string().url().optional(),
    revision: z.string().min(1).optional(),
    auth: requestAuthSchema.optional(),
    tools: describedToolsSchema,
  })
  .refine(
    (source) => (source.url === undefined) !== (source.document === undefined),
    'is read from a url, or written out in full as its document, but not both',
  );

const graphqlSchema = z.object({
  url: z.string().url(),
  document: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  depth: z.number().int().min(1).max(5).optional(),
  auth: requestAuthSchema.optional(),
  tools: describedToolsSchema,
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
  verify: verifySchema,
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
    integration: z
      .string()
      .regex(NAME, 'is the name this host is addressed by, as in slack')
      .refine(
        (named) => named !== CATALOG_SOURCE,
        'is catalog, which names Spotlight’s catalog: address this host by another name',
      ),
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
    openapi: openapiSchema.optional(),
    graphql: graphqlSchema.optional(),
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
      Object.keys(file.on).length > 0 ||
      file.openapi ||
      file.graphql,
    'must do something: a webhook, a poll, a schedule, an action to run, or an API description to offer tools from',
  )
  .refine(
    (file) => !(file.openapi && file.graphql),
    'offers tools from one API description: an openapi or a graphql, not both',
  );

export type IntegrationFile = z.infer<typeof integrationSchema>;
export type EventFile = z.infer<typeof eventSchema>;
export type AuthFile = AuthOptions;
export type RequestFile = z.infer<typeof requestSchema>;
export type RaiseFile = z.infer<typeof raiseSchema>;
export type OpenApiFile = z.infer<typeof openapiSchema>;
export type GraphQlFile = z.infer<typeof graphqlSchema>;
export type ToolInputFile = z.infer<typeof toolInputSchema>;

export const written = (held: string): string => {
  const [, inside] = EXPRESSION.exec(held) ?? [];

  return (inside ?? held).trim();
};

export const isExpression = (held: string): boolean => EXPRESSION.test(held);

export const secretOf = (reference: string): string =>
  reference.slice('secret.'.length);
