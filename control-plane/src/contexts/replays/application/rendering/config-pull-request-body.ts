import type { TaskRow, TaskSide } from '@replays/application/dto/task-rows.dto';
import {
  clippedText,
  markdownText,
} from '@replays/application/rendering/markdown-text';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';

interface ShownInterval {
  readonly low: number;
  readonly high: number;
}

interface ShownGain {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly significance: 'better' | 'worse' | 'within-noise';
  readonly minGain: number;
  readonly tasks: number;
}

interface ShownPairs {
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
}

interface PickedScores {
  readonly searchScore: number | null;
  readonly searchInterval: ShownInterval | null;
  readonly heldOutScore: number | null;
  readonly heldOutInterval: ShownInterval | null;
  readonly costPerRun: number | null;
}

interface ShownChange {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

interface SearchFacts {
  readonly trigger: 'schedule' | 'alert' | 'request';
  readonly iterations: number;
  readonly reflections: number;
  readonly maxIterations: number;
  readonly perIteration: number;
  readonly spent: number;
  readonly ceiling: number;
  readonly agent: {
    readonly harness: string;
    readonly model: string | null;
    readonly effort: string | null;
  } | null;
  readonly setRuns: number;
  readonly refreshedAt: Date | null;
  readonly spread: number | null;
  readonly minGain: number;
}

export interface ConfigPullRequestFacts {
  readonly objective: SearchObjective;
  readonly stationKey: string;
  readonly lineKey: string;
  readonly candidateName: string;
  readonly hypothesis: string | null;
  readonly unchecked: readonly string[];
  readonly changes: readonly ShownChange[];
  readonly candidate: PickedScores;
  readonly seed: PickedScores;
  readonly currency: string;
  readonly searchedTasks: number;
  readonly heldOutTasks: number;
  readonly regressions: {
    readonly searched: number | null;
    readonly heldOut: number | null;
    readonly total: number | null;
  };
  readonly maxRegressions: number | null;
  readonly exceedsRegressionLimit: boolean;
  readonly gains: {
    readonly searched: ShownGain | null;
    readonly heldOut: ShownGain | null;
  };
  readonly pairs: {
    readonly searched: ShownPairs | null;
    readonly heldOut: ShownPairs | null;
  };
  readonly overfit: 'likely' | 'too-few-held-out' | null;
  readonly heldOutPending: boolean;
  readonly tasks: {
    readonly searched: readonly TaskRow[];
    readonly heldOut: readonly TaskRow[];
  };
  readonly search: SearchFacts;
  readonly found: readonly string[];
}

const PICKED_BECAUSE: Readonly<Record<SearchObjective, string>> = {
  success:
    'Spotlight picked it because it did better than the live config on the held-out tasks.',
  cost: 'Spotlight picked it because it costs less per run than the live config and succeeds as often on the held-out tasks, within noise.',
};

const BODY_LIMIT = 65_536;

const MAX_BODY = 60_000;

const MAX_ROWS = 20;

const MAX_CHANGES = 30;

const MAX_INLINE = 80;

const MAX_VALUE = 1_000;

const MAX_FOLDED = 8;

const MAX_TITLE = 120;

const MAX_FOUND = 1_000;

const NOT_SCORED = '—';

const percent = (value: number): number => Math.round(value * 100);

const share = (score: number | null): string =>
  score === null ? NOT_SCORED : `${percent(score)}%`;

const shareWithin = (
  score: number | null,
  interval: ShownInterval | null,
): string =>
  score === null || interval === null
    ? share(score)
    : `${percent(score)}% (${percent(interval.low)}–${percent(interval.high)}%)`;

const points = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(percent(value))}`;

const describeGain = (where: string, gain: ShownGain | null): string | null => {
  if (!gain) {
    return null;
  }

  const range = `${points(gain.gain)} points (${points(gain.low)} to ${points(gain.high)})`;

  switch (gain.significance) {
    case 'better':
      return `On the ${where} tasks it gained ${range} on the live config, more than the ${percent(gain.minGain)}-point gain the line counts as real.`;
    case 'worse':
      return `On the ${where} tasks it lost ${range} against the live config.`;
    default:
      return `On the ${where} tasks the difference, ${range}, is within noise: it is not clearly more than the ${percent(gain.minGain)}-point gain the line counts as real.`;
  }
};

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

const describePairs = (
  where: string,
  pairs: ShownPairs | null,
): string | null =>
  pairs && pairs.wins + pairs.losses + pairs.ties > 0
    ? `Set side by side with the live config's change on the ${where} tasks, without the judge knowing which was which, its change was better on ${plural(pairs.wins, 'task')}, worse on ${plural(pairs.losses, 'task')} and as good on ${plural(pairs.ties, 'task')}.`
    : null;

const describeOverfit = (facts: ConfigPullRequestFacts): string | null => {
  const { searched, heldOut } = facts.gains;

  if (facts.heldOutPending) {
    return 'Its held-out replay had not finished when this pull request opened, so Spotlight could not yet check whether its gain also shows on the held-out tasks the search never showed its agent.';
  }
  if (!searched || !heldOut) {
    return null;
  }

  switch (facts.overfit) {
    case 'likely':
      return `Its gain showed only on the tasks the search could see: ${points(searched.gain)} points on the searched tasks, but ${points(heldOut.gain)} points on the held-out tasks the search never showed its agent. It may fit the searched tasks rather than work better in general, so weigh that before merging.`;
    case 'too-few-held-out':
      return `It gained ${points(searched.gain)} points on the searched tasks, but only ${plural(heldOut.tasks, 'held-out task')} scored on both sides, too few to tell whether the gain also shows on tasks the search never showed its agent.`;
    default:
      return null;
  }
};

const describeRegressionLimit = (
  facts: ConfigPullRequestFacts,
): string | null => {
  const { total } = facts.regressions;

  return facts.exceedsRegressionLimit && facts.maxRegressions !== null
    ? `Against the live config it regressed on ${plural(total ?? 0, 'task')}, over the line's regression limit of ${facts.maxRegressions} (\`max_regressions\`), so weigh that before merging.`
    : null;
};

const describeRegressions = (facts: ConfigPullRequestFacts): string => {
  const { searched, heldOut } = facts.regressions;
  const onSearched =
    searched === null
      ? null
      : `on ${searched} of ${plural(facts.searchedTasks, 'searched task')}`;
  const onHeldOut =
    heldOut === null
      ? null
      : `on ${heldOut} of ${plural(facts.heldOutTasks, 'held-out task')}`;
  const regressed = [onSearched, onHeldOut].filter(
    (each): each is string => each !== null,
  );

  return [
    ...(regressed.length > 0
      ? [`Against the live config it regressed ${regressed.join(' and ')}.`]
      : []),
    ...(searched === null
      ? [
          'Spotlight could not compare it with the live config on the searched tasks.',
        ]
      : []),
    ...(heldOut === null
      ? [
          facts.heldOutPending
            ? 'Its held-out replay had not finished.'
            : 'It was not replayed on the held-out tasks.',
        ]
      : []),
    'The search never showed its agent the held-out tasks.',
  ].join(' ');
};

const cost = (amount: number | null, currency: string): string =>
  amount === null ? NOT_SCORED : `${amount.toFixed(2)} ${currency}`;

const fenced = (text: string): string => {
  const longest = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map((each) => each[0].length),
  );
  const fence = '`'.repeat(Math.max(3, longest + 1));

  return `${fence}text\n${text.trim()}\n${fence}`;
};

const defused = (text: string): string => text.replace(/@/g, '@\u200b');

const capped = (text: string, max: number): string =>
  text.length > max
    ? `${text.slice(0, max)}\n… Spotlight cut this value at ${max} characters.`
    : text;

const isInline = (value: string | null): boolean =>
  value === null || (value.length <= MAX_INLINE && !value.includes('\n'));

const inline = (value: string | null): string =>
  value === null ? 'not set' : `\`${defused(value).replace(/`/g, "'")}\``;

const changeName = (change: ShownChange): string =>
  change.name
    ? `\`${change.part}\` · ${markdownText(clippedText(change.name, MAX_TITLE))}`
    : `\`${change.part}\``;

const isLong = (change: ShownChange): boolean =>
  !isInline(change.was) || !isInline(change.now);

const listedChange = (change: ShownChange): string =>
  isLong(change)
    ? `- ${changeName(change)}: ${change.kind}. The value is too long to show here.`
    : `- ${changeName(change)}: ${inline(change.was)} → ${inline(change.now)}`;

const foldedChange = (change: ShownChange): string => {
  const shown = (label: string, value: string | null): string =>
    value === null
      ? `${label}: not set`
      : `${label}:\n\n${fenced(capped(defused(value), MAX_VALUE))}`;

  return [
    `**${changeName(change)}**: ${change.kind}`,
    '',
    '<details><summary>Was and now</summary>',
    '',
    shown('Was', change.was),
    '',
    shown('Now', change.now),
    '',
    '</details>',
  ].join('\n');
};

const describeChanges = (changes: readonly ShownChange[]): string => {
  const shown = changes.slice(0, MAX_CHANGES);
  const folded = shown.filter(isLong).slice(0, MAX_FOLDED);
  const listed = shown.filter((each) => !folded.includes(each));
  const more = changes.length - shown.length;

  return [
    '## What changes',
    ...(listed.length > 0 || more > 0
      ? [
          [
            ...listed.map(listedChange),
            ...(more > 0
              ? [`- ${plural(more, 'more change')} are not shown.`]
              : []),
          ].join('\n'),
        ]
      : []),
    ...folded.map(foldedChange),
  ].join('\n\n');
};

const RESULTS: Readonly<Record<TaskSide['result'], string>> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  mixed: 'Succeeded',
  unscored: 'Not scored',
  pending: 'Running',
  absent: 'Not replayed',
};

const cell = (text: string, max = MAX_FOUND): string =>
  markdownText(clippedText(text.replace(/\s+/g, ' ').trim(), max));

const sideCell = (side: TaskSide): string => {
  const result =
    side.result === 'mixed' && side.successRate !== null
      ? `${RESULTS.mixed} ${percent(side.successRate)}%`
      : RESULTS[side.result];

  return cell(`${result}: ${side.reason}`);
};

const UNTITLED = 'Untitled task';

const taskTable = (title: string, rows: readonly TaskRow[]): string[] => {
  if (rows.length === 0) {
    return [];
  }

  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;

  return [
    `### ${title}`,
    '',
    '| Task | Live config | Candidate | Regressed |',
    '| --- | --- | --- | --- |',
    ...shown.map(
      (row) =>
        `| ${cell(row.title ?? UNTITLED, MAX_TITLE)} | ${sideCell(row.live)} | ${sideCell(row.candidate)} | ${row.regressed ? 'Yes' : 'No'} |`,
    ),
    ...(more > 0 ? ['', `+${plural(more, 'more task')}.`] : []),
    '',
  ];
};

const describeTasks = (facts: ConfigPullRequestFacts): string | null => {
  const tables = [
    ...taskTable('Held-out tasks', facts.tasks.heldOut),
    ...taskTable('Searched tasks', facts.tasks.searched),
  ];

  return tables.length > 0
    ? ['## Task by task', '', ...tables].join('\n').trimEnd()
    : null;
};

const TRIGGERS: Readonly<Record<SearchFacts['trigger'], string>> = {
  schedule: 'the schedule of the search policy',
  alert: 'a station alert',
  request: 'a person, from a chat that improves the station',
};

const describeSearch = (
  search: SearchFacts,
  facts: ConfigPullRequestFacts,
): string => {
  const agent = search.agent
    ? [search.agent.harness, search.agent.model, search.agent.effort]
        .filter((each) => each !== null)
        .join(' · ')
    : 'none, Spotlight replayed only the candidate a person asked for';
  const refreshed = search.refreshedAt
    ? `refreshed ${search.refreshedAt.toISOString().slice(0, 10)}`
    : 'not refreshed yet';
  const noise =
    search.spread === null
      ? 'Spotlight has not measured the noise of the replay set yet.'
      : `Success on the replay set moves by up to ${percent(search.spread)} points between repeats of the same runs.`;

  return [
    '## About this search',
    '',
    `- Started by: ${TRIGGERS[search.trigger]}`,
    `- Iterations: ${search.iterations} of ${search.maxIterations}, with up to ${plural(search.perIteration, 'candidate')} in each`,
    ...(search.reflections > 0
      ? [
          `- Reflections: ${search.reflections} of the iterations looked into why tasks failed`,
        ]
      : []),
    `- Spent: ${cost(search.spent, facts.currency)} of the ${cost(search.ceiling, facts.currency)} ceiling`,
    `- Search agent: ${agent}`,
    `- Tasks: ${facts.searchedTasks} searched, ${facts.heldOutTasks} held out`,
    `- Replay set: ${plural(search.setRuns, 'run')}, ${refreshed}`,
    `- Noise: ${noise} The line counts a gain of at least ${percent(search.minGain)} points as real (\`min_gain\`).`,
  ].join('\n');
};

const describeFound = (found: readonly string[]): string | null =>
  found.length > 0
    ? [
        '## What else Spotlight found',
        '',
        ...found.map((each) => `- ${cell(each)}`),
      ].join('\n')
    : null;

const SEPARATOR = '\n\n';

const fitBody = (sections: readonly string[]): string => {
  const kept = [...sections];
  const lengthOf = (parts: readonly string[], note: string) =>
    parts.join(SEPARATOR).length + note.length + SEPARATOR.length;
  const noteFor = (left: number) =>
    left === 0
      ? ''
      : `Spotlight left out the last ${plural(left, 'section')} to keep this description under the limit of GitHub, ${BODY_LIMIT} characters.`;

  while (
    kept.length > 1 &&
    lengthOf(kept, noteFor(sections.length - kept.length)) > MAX_BODY
  ) {
    kept.pop();
  }

  const note = noteFor(sections.length - kept.length);

  return [...kept, ...(note ? [note] : [])].join(SEPARATOR);
};

export const ConfigPullRequestBody = {
  titleOf(facts: Pick<ConfigPullRequestFacts, 'stationKey' | 'candidateName'>) {
    return `${facts.stationKey}: ${facts.candidateName}`;
  },

  of(facts: ConfigPullRequestFacts): string {
    const { candidate, seed, currency } = facts;

    return fitBody([
      `Spotlight searched for a better config of the \`${facts.stationKey}\` station on the \`${facts.lineKey}\` line and found \`${defused(facts.candidateName)}\`. ${PICKED_BECAUSE[facts.objective]} This changes the station as the candidate has it: ${[...new Set(facts.changes.map((each) => each.part))].map((each) => `\`${each}\``).join(', ')}.`,
      ...[describeOverfit(facts), describeRegressionLimit(facts)].flatMap(
        (each) => (each ? [each] : []),
      ),
      describeChanges(facts.changes),
      ...(facts.hypothesis
        ? [
            `## Why it should be better\n\nThe agent that proposed it wrote:\n\n${fenced(capped(facts.hypothesis, MAX_VALUE))}`,
          ]
        : []),
      [
        '## How it scored',
        '',
        `| | \`${defused(facts.candidateName)}\` | Live config |`,
        '| --- | --- | --- |',
        `| Succeeded on the ${plural(facts.searchedTasks, 'searched task')} | ${shareWithin(candidate.searchScore, candidate.searchInterval)} | ${shareWithin(seed.searchScore, seed.searchInterval)} |`,
        `| Succeeded on the ${plural(facts.heldOutTasks, 'held-out task')} | ${shareWithin(candidate.heldOutScore, candidate.heldOutInterval)} | ${shareWithin(seed.heldOutScore, seed.heldOutInterval)} |`,
        `| Cost per run | ${cost(candidate.costPerRun, currency)} | ${cost(seed.costPerRun, currency)} |`,
        '',
        describeRegressions(facts),
        ...[
          describeGain('searched', facts.gains.searched),
          describeGain('held-out', facts.gains.heldOut),
          describePairs('searched', facts.pairs.searched),
          describePairs('held-out', facts.pairs.heldOut),
        ].flatMap((each) => (each ? ['', each] : [])),
      ].join('\n'),
      ...(facts.unchecked.length > 0
        ? [
            `## Not checked\n\nThe file computes ${facts.unchecked.map((each) => `\`${each}\``).join(', ')} in Terraform, so Spotlight could not check them against the config the search started from. Check them by hand.`,
          ]
        : []),
      ...[
        describeTasks(facts),
        describeSearch(facts.search, facts),
        describeFound(facts.found),
      ].flatMap((each) => (each ? [each] : [])),
    ]);
  },
};
