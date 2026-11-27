import type { JournalStep } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

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
  ['turn', 'Continued on its own'],
]);

const PROSE_KINDS = new Set<JournalStep['kind']>([
  'thought',
  'planned',
  'subagent',
  'reminded',
]);

const TOOL_DOING = new Map<string | null, string>([
  ['read', 'Reading'],
  ['edit', 'Editing'],
  ['write', 'Writing'],
  ['create', 'Creating'],
  ['execute', 'Running'],
  ['search', 'Searching'],
  ['grep', 'Searching'],
  ['web', 'Fetching'],
  ['fetch', 'Fetching'],
  ['mcp', 'Calling'],
]);

const KIND_DOING = new Map<JournalStep['kind'], string>([
  ['planned', 'Planning'],
  ['hook', 'Running'],
  ['subagent', 'Delegating'],
  ['waited', 'Waiting for'],
  ['reminded', 'Reminding'],
]);

const TOOL_TITLES = new Map<string | null, readonly string[]>([
  ['read', ['Read']],
  ['edit', ['Edit']],
  ['write', ['Write']],
  ['create', ['Create']],
  ['search', ['Search', 'Find', 'Glob']],
  ['grep', ['Grep', 'grep']],
  ['fetch', ['Fetch']],
  ['web', ['Fetch']],
]);

const withoutToolName = (step: JournalStep): string => {
  const named = TOOL_TITLES.get(step.tool)?.find(
    (name) => step.text === name || step.text.startsWith(`${name} `),
  );

  return nonEmpty(named)
    ? step.text.slice(named.length).trimStart()
    : step.text;
};

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
    nonEmpty(step.input) ? `Asked: ${step.input}` : null,
    step.detail,
    nonEmpty(step.output) ? `Answered: ${step.output}` : null,
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
  const detail = prose
    ? (step.text.split('\n')[0] ?? '')
    : withoutToolName(step);
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

const UNNAMED = new Set(['Terminal']);

const HOOK_DOING = new Map([
  ['restore', 'Restoring the workspace'],
  ['prepare', 'Preparing the workspace'],
  ['setup', 'Running setup'],
  ['archive', 'Saving the workspace'],
]);

export const doingOf = (step: JournalStep): string => {
  if (step.kind === 'thought') {
    return 'Thinking';
  }
  const hook = step.kind === 'hook' ? HOOK_DOING.get(step.text) : undefined;
  if (nonEmpty(hook)) {
    return hook;
  }
  const verb =
    KIND_DOING.get(step.kind) ?? TOOL_DOING.get(step.tool) ?? 'Using';
  const detail = shownStep(step).detail.split('\n')[0]?.trim() ?? '';
  if (!detail || UNNAMED.has(detail)) {
    return step.tool === 'execute' ? 'Running a command' : verb;
  }

  return `${verb} ${detail}`;
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
    const last = cut.at(-1);

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
