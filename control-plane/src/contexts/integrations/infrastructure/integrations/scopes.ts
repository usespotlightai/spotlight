import type { ActionCaller } from '@integrations/domain/value-objects/action-caller.vo';
import type { BindingSubject } from '@integrations/domain/value-objects/binding.vo';
import { type Declared, Scope } from '@platform/expressions/scope';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

export const OUTSIDE = 'dyn';

export const ITEM = 'item';

const TASK: Declared = {
  schema: {
    title: 'string',
    url: 'dyn',
    pullRequests: 'list<string>',
    line: 'string',
    station: 'string',
    stationKey: 'string',
    marks: 'map<string, string>',
  },
};

const ASK: Declared = {
  schema: {
    body: 'string',
    link: 'dyn',
    station: 'string',
    attachments: 'list',
  },
};

const CHAT: Declared = {
  schema: {
    marks: 'map<string, string>',
  },
};

const REPLY: Declared = {
  schema: {
    body: 'string',
    link: 'dyn',
    proposals: 'list',
  },
};

const REQUEST: Declared = {
  schema: {
    form: 'string',
    link: 'dyn',
  },
};

const NOTICE: Declared = {
  schema: {
    form: 'string',
    headline: 'string',
    points: 'list<string>',
    link: 'dyn',
    externalLink: 'dyn',
  },
};

const SUBJECT_VARIABLES = {
  task: ['ask', 'task'],
  chat: ['chat', 'reply'],
  'inbox-request': ['request', 'task'],
  notice: ['notice'],
} as const satisfies Readonly<Record<BindingSubject, readonly string[]>>;

export type SubjectVariable<Subject extends BindingSubject> =
  (typeof SUBJECT_VARIABLES)[Subject][number];

const TOOL_VARIABLES = ['inputs', 'task'] as const;

export type ToolVariable = (typeof TOOL_VARIABLES)[number];

const POSTED = ['target', 'uploaded'] as const;

export const CALLER_VARIABLES: Readonly<
  Record<ActionCaller, readonly string[]>
> = {
  task: [...SUBJECT_VARIABLES.task, ...POSTED],
  chat: [...SUBJECT_VARIABLES.chat, ...POSTED],
  'inbox-request': [...SUBJECT_VARIABLES['inbox-request'], ...POSTED],
  notice: [...SUBJECT_VARIABLES.notice, ...POSTED],
  tool: TOOL_VARIABLES,
  schedule: [],
};

const CALLER_DEPENDENT = [...new Set(Object.values(CALLER_VARIABLES).flat())];

const narrowed = new WeakMap<Scope, Map<string, Scope>>();

export const calledBy = (
  scope: Scope,
  callers: readonly ActionCaller[],
): Scope => {
  const key = callers.join(' ');
  const known = narrowed.get(scope) ?? new Map<string, Scope>();
  const cached = known.get(key);

  if (cached) {
    return cached;
  }

  const seen = scope.without(
    CALLER_DEPENDENT.filter(
      (name) => !callers.some((by) => CALLER_VARIABLES[by].includes(name)),
    ),
  );
  narrowed.set(scope, known.set(key, seen));

  return seen;
};

export const DELIVERED = Scope.of({
  body: OUTSIDE,
  headers: OUTSIDE,
  raw: 'string',
});

export const POLLING = Scope.of({
  cursor: 'string',
  connection: 'string',
});

export const POLLED = Scope.of({ body: OUTSIDE, cursor: 'string' });

const GIVEN_BY_SUBJECTS: Readonly<
  Record<SubjectVariable<BindingSubject>, Declared>
> = {
  task: TASK,
  ask: ASK,
  chat: CHAT,
  reply: REPLY,
  request: REQUEST,
  notice: NOTICE,
};

export const ADDRESSING = Scope.of(GIVEN_BY_SUBJECTS);

const NOTE_FILE: Declared = {
  schema: {
    id: 'string',
    name: 'string',
    type: 'string',
    size: 'double',
  },
};

export const UPLOADING = ADDRESSING.and({ target: 'map<string, string>' });

export const ACTING = UPLOADING.and({
  connection: 'string',
  uploaded: 'list',
});

export const PREPARING = UPLOADING.and({
  connection: 'string',
  file: NOTE_FILE,
});

export const SENDING = UPLOADING.and({
  connection: 'string',
  file: NOTE_FILE,
  prepared: 'map<string, dyn>',
});

export const COMPLETING = UPLOADING.and({
  connection: 'string',
  uploaded: 'list',
});

export const MARKING = ACTING.and({
  response: OUTSIDE,
  capture: 'map<string, dyn>',
});

export const LINKED = Scope.of({ response: OUTSIDE });

export const DEFAULTING = Scope.of({ task: TASK });

export const attaching = (scope: Scope): Scope => scope.and({ file: OUTSIDE });

export const answered = (scope: Scope): Scope =>
  scope.and({ response: OUTSIDE, status: OUTSIDE, headers: OUTSIDE });

export const seenAs = (schema: InputSchema): string => {
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'bool';
    case 'array':
    case 'integer':
    case 'null':
    case 'number':
    case 'object':
    case null:
      return OUTSIDE;
  }
};
