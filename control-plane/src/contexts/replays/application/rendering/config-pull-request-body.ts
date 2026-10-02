interface PickedScores {
  readonly searchScore: number | null;
  readonly heldOutScore: number | null;
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
  readonly link: string | null;
}

const NOT_SCORED = '—';

const share = (score: number | null): string =>
  score === null ? NOT_SCORED : `${Math.round(score * 100)}%`;

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
        `| Succeeded on the ${plural(facts.searchedTasks, 'searched task')} | ${share(candidate.searchScore)} | ${share(seed.searchScore)} |`,
        `| Succeeded on the ${plural(facts.heldOutTasks, 'held-out task')} | ${share(candidate.heldOutScore)} | ${share(seed.heldOutScore)} |`,
        `| Cost per run | ${cost(candidate.costPerRun, currency)} | ${cost(seed.costPerRun, currency)} |`,
        '',
        `Against the live config it regressed on ${plural(facts.regressions.searched, 'searched task')}; on the held-out tasks, ${heldOut}. The search never showed its agent the held-out tasks.`,
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
