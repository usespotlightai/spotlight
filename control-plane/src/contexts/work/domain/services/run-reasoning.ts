import { isJsonObject } from '@shared-kernel/domain/json-value';
import type { StepKind } from '@work/domain/value-objects/step-kind';

/** The commands of the spotlight CLI that a briefing tells the agent to run, and that its journal shows it ran. */
export const HANDOVER_COMMAND = 'spotlight handover';

export const REMEMBER_COMMAND = 'spotlight remember';

export const FORGET_COMMAND = 'spotlight forget';

export const DECIDE_COMMAND = 'spotlight decide';

type ReasoningKind =
  | 'message'
  | 'thought'
  | 'planned'
  | 'handover'
  | 'remember';

export interface Reasoning {
  readonly kind: ReasoningKind;
  readonly text: string;
  /** Where in the text the spotlight command that the step ran starts; null where it ran none. */
  readonly commandAt: number | null;
}

const REASONING_KINDS: Partial<Record<StepKind, ReasoningKind>> = {
  message: 'message',
  thought: 'thought',
  planned: 'planned',
};

const invoking = (command: string): RegExp =>
  new RegExp(
    `(?:^\\s*\`?|&&|;|\\|\\||\\n|"command"\\s*:\\s*")\\s*(${command.split(' ').join('\\s+')})\\b`,
  );

const COMMANDS: readonly [RegExp, ReasoningKind][] = [
  [invoking(HANDOVER_COMMAND), 'handover'],
  [invoking(REMEMBER_COMMAND), 'remember'],
  [invoking(FORGET_COMMAND), 'remember'],
];

const shellOf = (text: string): string => {
  try {
    const read: unknown = JSON.parse(text);

    return isJsonObject(read) && typeof read.command === 'string'
      ? read.command
      : text;
  } catch {
    return text;
  }
};

const firstIn = (text: string): Reasoning | null => {
  const shell = shellOf(text);
  const found = COMMANDS.flatMap(([invoked, kind]) => {
    const match = invoked.exec(shell);
    const command = match?.[1];

    return match && command
      ? [{ at: match.index + match[0].length - command.length, kind }]
      : [];
  }).sort((one, other) => one.at - other.at);
  const first = found[0];

  return first ? { kind: first.kind, text: shell, commandAt: first.at } : null;
};

const commanded = (step: {
  readonly text: string;
  readonly input?: string | null;
}): Reasoning | null =>
  firstIn(step.text) ?? (step.input ? firstIn(step.input) : null);

export const reasoningIn = (step: {
  readonly kind: StepKind;
  readonly text: string;
  readonly input?: string | null;
}): Reasoning | null => {
  if (!step.text.trim()) {
    return null;
  }

  if (step.kind === 'tool') {
    return commanded(step);
  }

  const kind = REASONING_KINDS[step.kind];
  return kind ? { kind, text: step.text, commandAt: null } : null;
};
