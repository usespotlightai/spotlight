interface ShownInterval {
  readonly low: number;
  readonly high: number;
}

interface ShownGain {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly verdict: 'better' | 'worse' | 'within-noise';
  readonly minGain: number;
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
    readonly searched: number;
    readonly heldOut: number | null;
  };
  readonly gains: {
    readonly searched: ShownGain | null;
    readonly heldOut: ShownGain | null;
  };
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

const gainSays = (where: string, gain: ShownGain | null): string | null => {
  if (!gain) {
    return null;
  }

  const range = `${points(gain.gain)} points (${points(gain.low)} to ${points(gain.high)})`;

  switch (gain.verdict) {
    case 'better':
      return `On the ${where} tasks it gained ${range} on the live config, more than the ${percent(gain.minGain)}-point gain the line counts as real.`;
    case 'worse':
      return `On the ${where} tasks it lost ${range} against the live config.`;
    default:
      return `On the ${where} tasks the difference, ${range}, is within noise: it is not clearly more than the ${percent(gain.minGain)}-point gain the line counts as real.`;
  }
};

const cost = (amount: number | null, currency: string): string =>
  amount === null ? NOT_SCORED : `${amount.toFixed(2)} ${currency}`;

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

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
    const heldOut =
      candidate.heldOutScore === null && facts.regressions.heldOut === null
        ? 'it was not replayed on the held-out tasks'
        : plural(facts.regressions.heldOut ?? 0, 'held-out task');

    return [
      `Spotlight searched for a better config of the \`${facts.stationKey}\` station on the \`${facts.lineKey}\` line and found \`${defused(facts.candidateName)}\`, which a person picked. This changes the station as the candidate has it: ${facts.changes.map((each) => `\`${each}\``).join(', ')}.`,
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
        `Against the live config it regressed on ${plural(facts.regressions.searched, 'searched task')}; on the held-out tasks, ${heldOut}. The search never showed its agent the held-out tasks.`,
        ...[
          gainSays('searched', facts.gains.searched),
          gainSays('held-out', facts.gains.heldOut),
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
