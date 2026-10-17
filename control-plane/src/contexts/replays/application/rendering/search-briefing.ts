import { SEARCHABLE_FIELDS } from '@replays/domain/services/searchable-changes';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';

export const SEED_HYPOTHESIS =
  'The live config the search started from, replayed as it is.';

export interface SearchBriefingFacts {
  readonly stationKey: string;
  readonly stationName: string;
  readonly lineKey: string;
  readonly seed: StationBlock;
  readonly iteration: number;
  readonly iterations: number;
  readonly perIteration: number;
  readonly left: Spend;
  readonly ceiling: Spend;
  readonly searchedTasks: number;
  readonly heldOutTasks: number;
  readonly objective: SearchObjective;
  readonly configCauses: readonly SearchCause[];
}

const AIMS: Readonly<Record<SearchObjective, string>> = {
  success: `## What counts as better\n\nA candidate is better when it succeeds on more tasks. Where two succeed as often, the cheaper one per run is better.`,
  cost: `## What counts as better\n\nThe live config already succeeds on nearly every task, so this search looks for the same success at less cost. A candidate is better when it costs less per run and succeeds as often as the live config, within noise. One that succeeds clearly less often is out, however cheap. Look for what the station spends without needing to: a cheaper model or a lower effort, a shorter prompt, fewer tools or skills.`,
};

const foundOf = (causes: readonly SearchCause[]): string[] =>
  causes.length === 0
    ? []
    : [
        [
          '## What looking into the stall found',
          '',
          'An earlier iteration looked into why the search stalled, and found these failures a change to the config could fix:',
          '',
          ...causes.map(
            (each) =>
              `- Task \`${each.taskId.value}\`: ${each.evidence}${each.suggestion ? ` Suggested: ${each.suggestion}` : ''}`,
          ),
        ].join('\n'),
      ];

const money = (spend: Spend): string =>
  `${spend.amount.toFixed(2)} ${spend.currency}`;

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

export const SearchBriefing = {
  of(facts: SearchBriefingFacts): string {
    const { stationKey: key, lineKey: line } = facts;
    const folder = `.spotlight/history/${key}`;
    const afterThis = facts.iterations - facts.iteration;

    return [
      '# Searching for a better station',
      `You are iteration ${facts.iteration} of ${facts.iterations} of a search for a better config of the ${facts.stationName} station (\`${key}\`) on the \`${line}\` line. Spotlight replays each candidate you propose on the station's own past tasks and scores it as the station is scored: its checks and its judge. Work from what those replays actually did, not from guesses.`,
      AIMS[facts.objective],
      ...foundOf(facts.configCauses),
      `## Where the search started\n\nEvery candidate is a change to this station block, the station's live config when the search started:\n\n\`\`\`json\n${JSON.stringify(facts.seed.value, null, 2)}\n\`\`\``,
      [
        '## What you have to spend',
        '',
        `- Propose at most ${plural(facts.perIteration, 'candidate')} in this run.`,
        `- ${money(facts.left)} of the search's ${money(facts.ceiling)} are left, for every replay and agent run still to come.`,
        `- ${afterThis === 0 ? 'No iterations come after this one' : `${plural(afterThis, 'more iteration')} may follow this one, each starting from what the candidates so far scored`}.`,
      ].join('\n'),
      `## What you see\n\nCandidates are replayed on ${plural(facts.searchedTasks, 'task')}. Spotlight holds out ${plural(facts.heldOutTasks, 'more task')} you never see: the best candidates are scored on them once the search ends, so a change that only fits the tasks you see will not win.`,
      [
        '## What may change',
        '',
        `A candidate may change only the station's ${SEARCHABLE_FIELDS.map((each) => `\`${each}\``).join(', ')}. Keep every other field exactly as the block above has it: its key, name, kind, check, judge, alerts, passesTo, ends, runners and the rest. Spotlight rejects a candidate that changes one of them.`,
      ].join('\n'),
      [
        '## How to go about it',
        '',
        `1. Write the station's runs and this search's results to files:\n\n   \`\`\`\n   spotlight history --station ${key} --line ${line}\n   \`\`\`\n\n   It prints where it wrote them: \`${folder}/index.md\` has one line per run and a table of the candidates so far; \`current.json\` is the block above; each run has \`runs/<run>/journal.md\`, \`outcome.json\` and, where it changed code, \`diff.patch\`; each candidate has \`candidates/<name>/block.json\`, \`changes.diff\`, \`hypothesis.md\`, \`score.json\` and the journal and result of each of its replay runs under \`runs/<original run>/\`. The candidate named \`${SEED_NAME}\` is the block above, replayed as it is. Read and \`grep -r\` across those files with your own tools.`,
        '2. Find what made runs fail, then change the block to fix that. Change one thing per candidate, or say why two changes cannot be separated.',
        `3. Propose each candidate, from a file or from stdin:\n\n   \`\`\`\n   spotlight candidate --name <name> --hypothesis <text | @file> <station.json | ->\n   \`\`\`\n\n   The name is a slug: lowercase letters, digits and hyphens, starting with a letter or digit, at most 63 characters, unique in this search, and not \`${SEED_NAME}\`. The hypothesis says what you expect the change to improve, and why.`,
        '4. A rejected candidate comes back with the problems in it; fix them and propose it again. A rejected one does not count as one of your candidates, but you may only try so often.',
        '5. End the run once you have proposed your candidates. Spotlight replays them after you, and the next iteration sees how they did.',
      ].join('\n'),
    ].join('\n\n');
  },
};
