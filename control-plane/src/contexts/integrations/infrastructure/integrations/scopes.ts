import type { ToolInputType } from '@integrations/domain/value-objects/offered-tool.vo';
import { type Declared, Scope } from '@platform/expressions/scope';

export const OUTSIDE = 'dyn';

export const ITEM = 'item';

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

export const ACTING = Scope.of({
  task: TASK,
  ask: ASK,
  target: 'map<string, string>',
  connection: 'string',
});

export const ADDRESSING = Scope.of({ task: TASK, ask: ASK });

export const MARKING = ACTING.and({
  response: OUTSIDE,
  capture: 'map<string, dyn>',
});

export const LINKED = Scope.of({ response: OUTSIDE });

export const DEFAULTING = Scope.of({ task: TASK });

export const attaching = (scope: Scope): Scope => scope.and({ file: OUTSIDE });

export const answered = (scope: Scope): Scope =>
  scope.and({ response: OUTSIDE, status: OUTSIDE, headers: OUTSIDE });

const TOOL_INPUTS_AS: Readonly<Record<ToolInputType, string>> = {
  string: 'string',
  number: 'dyn',
  boolean: 'bool',
};

export const seenAs = (type: ToolInputType): string => TOOL_INPUTS_AS[type];
