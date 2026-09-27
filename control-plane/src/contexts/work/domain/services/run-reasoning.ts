import type { StepKind } from '@work/domain/value-objects/step-kind';

export const HANDOVER_COMMAND = 'spotlight handover';

export const REMEMBER_COMMAND = 'spotlight remember';

type ReasoningKind = 'said' | 'thought' | 'planned' | 'handover' | 'remember';

export interface Reasoning {
  readonly kind: ReasoningKind;
  readonly text: string;
}

const SPOKEN: Partial<Record<StepKind, ReasoningKind>> = {
  said: 'said',
  thought: 'thought',
  planned: 'planned',
};

const invoking = (command: string): RegExp =>
  new RegExp(
    `(?:^\\s*\`?|&&|;|\\|\\||\\n|"command"\\s*:\\s*")\\s*${command.split(' ').join('\\s+')}\\b`,
  );

const COMMANDS: readonly [RegExp, ReasoningKind][] = [
  [invoking(HANDOVER_COMMAND), 'handover'],
  [invoking(REMEMBER_COMMAND), 'remember'],
];

const firstIn = (text: string): ReasoningKind | null => {
  const found = COMMANDS.flatMap(([invoked, kind]) => {
    const at = invoked.exec(text)?.index;
    return at === undefined ? [] : [{ at, kind }];
  }).sort((one, other) => one.at - other.at);

  return found[0]?.kind ?? null;
};

const commanded = (step: {
  readonly text: string;
  readonly given?: string | null;
}): Reasoning | null => {
  const titled = firstIn(step.text);
  if (titled) {
    return { kind: titled, text: step.text };
  }

  const given = step.given ? firstIn(step.given) : null;
  return given && step.given ? { kind: given, text: step.given } : null;
};

export const reasoningIn = (step: {
  readonly kind: StepKind;
  readonly text: string;
  readonly given?: string | null;
}): Reasoning | null => {
  if (!step.text.trim()) {
    return null;
  }

  if (step.kind === 'tool') {
    return commanded(step);
  }

  const kind = SPOKEN[step.kind];
  return kind ? { kind, text: step.text } : null;
};
