import {
  BINDING_SUBJECTS,
  EVENT_ABOUT,
} from '@integrations/domain/value-objects/binding.vo';

export const ACTION_CALLERS = [
  ...BINDING_SUBJECTS,
  'tool',
  'schedule',
] as const;

export type ActionCaller = (typeof ACTION_CALLERS)[number];

export const CALLER_ABOUT: Readonly<Record<ActionCaller, string>> = {
  ...EVENT_ABOUT,
  tool: 'A tool',
  schedule: 'A schedule',
};

export const sendsFiles = (caller: ActionCaller): boolean => caller === 'task';
