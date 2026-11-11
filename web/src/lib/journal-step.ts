import type { JournalStep } from '@/lib/inbox';

const TOOL_VERBS = new Map<string | null, string>([
  ['read', 'Read'],
  ['edit', 'Edited'],
  ['write', 'Wrote'],
  ['create', 'Created'],
  ['execute', 'Ran'],
  ['search', 'Searched'],
  ['grep', 'Grepped'],
  ['web', 'Fetched'],
  ['fetch', 'Fetched'],
  ['mcp', 'Called'],
]);

const KIND_VERBS = new Map<JournalStep['kind'], string>([
  ['thought', 'Thought'],
  ['planned', 'Planned'],
  ['hook', 'Ran'],
  ['subagent', 'Delegated'],
  ['waited', 'Waited for'],
  ['lost', 'Stopped'],
  ['reminded', 'Reminded'],
]);

const PROSE_KINDS = new Set<JournalStep['kind']>([
  'thought',
  'planned',
  'subagent',
  'reminded',
]);

const verbFor = (step: JournalStep): string =>
  KIND_VERBS.get(step.kind) ?? TOOL_VERBS.get(step.tool) ?? 'Used';

export interface ShownStep {
  readonly keyword: string;
  readonly detail: string;
  readonly label: string;
  readonly body: string | null;
  readonly prose: boolean;
  readonly terminal: boolean;
}

const delegatedOf = (step: JournalStep): string | null =>
  [
    step.input && `Asked: ${step.input}`,
    step.detail,
    step.output && `Answered: ${step.output}`,
  ]
    .filter(Boolean)
    .join('\n\n') || null;

const bodyOf = (step: JournalStep, detail: string): string | null => {
  if (step.kind === 'subagent') {
    return delegatedOf(step);
  }
  if (step.kind !== 'thought') {
    return step.detail;
  }

  return step.text.length > detail.length ? step.text : null;
};

export const shownStep = (step: JournalStep): ShownStep => {
  const prose = PROSE_KINDS.has(step.kind);
  const detail = prose ? (step.text.split('\n')[0] ?? '') : step.text;
  const keyword = verbFor(step);

  return {
    keyword,
    detail,
    label: `${keyword} ${detail}`.trim(),
    body: bodyOf(step, detail),
    prose,
    terminal: step.kind === 'hook' || step.tool === 'execute',
  };
};

export const stillRunning = (step: JournalStep, live: boolean): boolean =>
  live && (step.status === 'running' || step.status === 'pending');

export type StepStretch =
  | {
      readonly kind: 'said';
      readonly at: number;
      readonly step: JournalStep;
    }
  | {
      readonly kind: 'worked';
      readonly at: number;
      readonly steps: readonly [JournalStep, ...JournalStep[]];
    };

export const stretchesOf = (steps: readonly JournalStep[]): StepStretch[] => {
  const cut: StepStretch[] = [];

  steps.forEach((step, at) => {
    const last = cut[cut.length - 1];

    if (step.kind === 'message') {
      cut.push({ kind: 'said', at, step });
    } else if (last?.kind === 'worked') {
      cut[cut.length - 1] = { ...last, steps: [...last.steps, step] };
    } else {
      cut.push({ kind: 'worked', at, steps: [step] });
    }
  });

  return cut;
};
