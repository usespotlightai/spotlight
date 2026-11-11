import { HOOK_EVENTS } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HOOK_ON_FAILURES,
  Hook,
  isSetBySpotlight,
  SET_BY_SPOTLIGHT_REASON,
} from '@integrations/domain/value-objects/hook.vo';
import { SLUG_SHAPE } from '@shared-kernel/domain/value-objects/identifier-shapes';
import { z } from 'zod';

const KEY = new RegExp(`^${SLUG_SHAPE}$`);

const TOOL = new RegExp(`^[a-z0-9]+\\.${SLUG_SHAPE}$`);

const VAR = /^[A-Za-z_][A-Za-z0-9_]*$/;

const HEADER = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

const key = (what: string) =>
  z.string().regex(KEY, `is lowercase words joined by dashes, as in ${what}`);

const tool = z
  .string()
  .regex(
    TOOL,
    'names a tool as the integration and the tool, as in grafana.search',
  );

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(json),
    z.record(z.string(), json),
  ]),
);

const header = z
  .string()
  .regex(HEADER, 'is a header name, as in x-team')
  .refine((name) => !isSetBySpotlight(name), {
    message: SET_BY_SPOTLIGHT_REASON,
  });

const requestSchema = z
  .object({
    url: z.string().min(1, 'is the address to send the request to'),
    headers: z.record(header, z.string()).default({}),
    body: json.optional(),
    from: z.enum(['spotlight', 'network']).optional(),
  })
  .strict();

const stepSchema = z
  .object({
    name: key('notify'),
    call: tool.optional(),
    with: z.record(z.string(), json).optional(),
    request: requestSchema.optional(),
  })
  .strict()
  .superRefine((step, context) => {
    if ((step.call === undefined) === (step.request === undefined)) {
      context.addIssue({
        code: 'custom',
        message:
          'names exactly one of call and request. A step either calls a tool or makes a request',
      });
    }

    if (step.with !== undefined && step.call === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['with'],
        message: 'sets inputs for a tool. It goes only with call',
      });
    }
  });

const signingSchema = z.union([
  z
    .object({
      secret: z.string().optional(),
      secretVersion: z.number().int('is a whole number').min(1, 'starts at 1'),
    })
    .strict(),
  z
    .object({
      oidc: z
        .object({
          audience: z
            .string()
            .min(1, 'is who the token is for, as the endpoint checks it'),
        })
        .strict(),
    })
    .strict(),
]);

const matchSchema = z
  .object({
    tools: z.array(tool).default([]),
    lines: z.array(key('delivery')).default([]),
    stations: z.array(key('implementation')).default([]),
    repositories: z.array(z.string()).default([]),
    paths: z
      .array(z.string().min(1, 'is a path pattern, as in db/migrations/**'))
      .default([]),
  })
  .strict();

export const hookSchema = z
  .object({
    key: key('migrations-need-a-dba'),
    on: z.enum(HOOK_EVENTS as [string, ...string[]], {
      message: `is one of ${HOOK_EVENTS.join(', ')}`,
    }),
    match: matchSchema.default({
      tools: [],
      lines: [],
      stations: [],
      repositories: [],
      paths: [],
    }),
    when: z.string().min(1).optional(),
    vars: z
      .record(
        z.string().regex(VAR, 'is a name CEL can read, as in migrations'),
        z.string(),
      )
      .default({}),
    steps: z.array(stepSchema),
    signing: signingSchema.nullable().default(null),
    failure: z.enum(HOOK_ON_FAILURES).default(Hook.DEFAULTS.failure),
    timeoutSeconds: z.number().default(Hook.DEFAULTS.timeoutSeconds),
  })
  .strict();

export type HookFile = z.infer<typeof hookSchema>;

export type HookStepFile = HookFile['steps'][number];
