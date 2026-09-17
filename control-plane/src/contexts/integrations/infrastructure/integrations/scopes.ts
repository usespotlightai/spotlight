import {
  type Declared,
  Scope,
} from '@integrations/infrastructure/integrations/expression';

const OUTSIDE = 'dyn';

const TASK: Declared = {
  schema: {
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
  },
};

const SECRETS = { secret: 'map<string, string>' } as const;

export const DELIVERED = Scope.of({
  body: OUTSIDE,
  headers: OUTSIDE,
  raw: 'string',
});

export const POLLING = Scope.of({
  cursor: 'string',
  ...SECRETS,
  connection: 'string',
});

export const POLLED = Scope.of({ body: OUTSIDE, cursor: 'string' });

export const ACTING = Scope.of({
  task: TASK,
  ask: ASK,
  target: 'map<string, string>',
  ...SECRETS,
  connection: 'string',
});

export const ADDRESSING = Scope.of({ task: TASK, ask: ASK });

export const MARKING = ACTING.and({
  response: OUTSIDE,
  capture: 'map<string, dyn>',
});

export const LINKED = Scope.of({ response: OUTSIDE });

export const iterating = (scope: Scope): Scope => scope.and({ item: OUTSIDE });

export const attaching = (scope: Scope): Scope => scope.and({ file: OUTSIDE });

export const capturing = (scope: Scope, names: readonly string[]): Scope =>
  scope.and(Object.fromEntries(names.map((name) => [name, OUTSIDE])));

export const requesting = (scope: Scope): Scope => scope.and(SECRETS);

export const answered = (scope: Scope): Scope =>
  scope.and({ response: OUTSIDE, status: OUTSIDE, headers: OUTSIDE });

export const DEFAULTING = Scope.of({ task: TASK });

export const withInputs = (
  scope: Scope,
  inputs: Readonly<Record<string, string>>,
): Scope => scope.and({ inputs: { schema: { ...inputs } } });
