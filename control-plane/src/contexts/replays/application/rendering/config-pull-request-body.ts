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

export interface ConfigPullRequestFacts {
  readonly stationKey: string;
  readonly lineKey: string;
  readonly candidateName: string;
  readonly hypothesis: string | null;
  readonly unchecked: readonly string[];
  readonly changes: readonly string[];
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
  readonly link: string | null;
}

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
      ? 'it could not be compared on the searched tasks'
      : `it regressed on ${plural(searched, 'searched task')}`;
  const onHeldOut =
    heldOut !== null
      ? plural(heldOut, 'held-out task')
      : facts.heldOutPending
        ? 'its replay had not finished'
        : 'it was not replayed on the held-out tasks';

  return `Against the live config ${onSearched}; on the held-out tasks, ${onHeldOut}. The search never showed its agent the held-out tasks.`;
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

export const ConfigPullRequestBody = {
  titleOf(facts: Pick<ConfigPullRequestFacts, 'stationKey' | 'candidateName'>) {
    return `${facts.stationKey}: ${facts.candidateName}`;
  },

  of(facts: ConfigPullRequestFacts): string {
    const { candidate, seed, currency } = facts;

    return [
      `Spotlight searched for a better config of the \`${facts.stationKey}\` station on the \`${facts.lineKey}\` line and found \`${defused(facts.candidateName)}\`, which a person picked. This changes the station as the candidate has it: ${facts.changes.map((each) => `\`${each}\``).join(', ')}.`,
      ...[describeOverfit(facts), describeRegressionLimit(facts)].flatMap(
        (each) => (each ? [each] : []),
      ),
      ...(facts.hypothesis
        ? [
            `## Why it should be better\n\nThe search's agent wrote:\n\n${fenced(facts.hypothesis)}`,
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
      ...(facts.link ? [`[See the search in Spotlight](${facts.link})`] : []),
    ].join('\n\n');
  },
};
