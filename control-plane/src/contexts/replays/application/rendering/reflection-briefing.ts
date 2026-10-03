import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';

export interface ReflectionBriefingFacts {
  readonly stationKey: string;
  readonly stationName: string;
  readonly lineKey: string;
  readonly iteration: number;
  readonly iterations: number;
  readonly standing: string;
  readonly seed: boolean;
  readonly tasks: readonly ReflectedTask[];
}

const CAUSES = [
  '- `config`: the station’s config is why it failed, and a change the search may make (its prompt, model, effort, tools, skills and the like) could make it succeed.',
  '- `task`: the task itself is why: it is unclear, asks for something impossible, or depends on something its replay does not have. Suggest taking it out of the replay set, or how to word it.',
  '- `judge`: the judge scored it wrong: the run did what the task asked, but the rubric or the judge failed it. Suggest how to fix the rubric.',
  '- `check`: the station’s check failed for a reason the change did not cause, or fails and passes by chance. Suggest how to fix the check.',
  '- `infra`: the run failed around the work, not in it: a timeout, the network, a missing tool or service.',
].join('\n');

export const ReflectionBriefing = {
  of(facts: ReflectionBriefingFacts): string {
    const { stationKey: key, lineKey: line } = facts;
    const folder = `.spotlight/history/${key}`;
    const best = facts.seed
      ? `the live config the search started from, \`${facts.standing}\``
      : `the candidate \`${facts.standing}\``;

    return [
      '# Looking into why a search stalled',
      `You are iteration ${facts.iteration} of ${facts.iterations} of a search for a better config of the ${facts.stationName} station (\`${key}\`) on the \`${line}\` line. Its last two iterations proposed nothing that beat the best config before them. Before it spends more, find out why the tasks below still fail, and whether a change to the station’s config could fix them at all.`,
      '## Propose nothing\n\nThis run proposes no candidates: Spotlight refuses `spotlight candidate` from it. It records one cause for each failing task.',
      [
        '## The failing tasks',
        '',
        `The best config so far is ${best}. It still fails these searched tasks:`,
        '',
        '| Task | Original run | Failing replay run |',
        '| --- | --- | --- |',
        ...facts.tasks.map(
          (each) =>
            `| \`${each.taskId.value}\` | \`${each.originalRunId.value}\` | \`${each.replayRunId.value}\` |`,
        ),
      ].join('\n'),
      `## Causes\n\nGive each task the one cause that explains its failure best:\n\n${CAUSES}`,
      [
        '## How to go about it',
        '',
        `1. Write the station’s runs and this search’s results to files:\n\n   \`\`\`\n   spotlight history --station ${key} --line ${line}\n   \`\`\`\n\n   It prints where it wrote them, under \`${folder}\`. Each failing replay is in \`candidates/${facts.standing}/runs/<original run>/\` (one folder per copy where each run was replayed more than once): its \`journal.md\`, \`result.json\` with the judge’s verdict and reasons, and \`diff.patch\`. The original run is in \`runs/<original run>/\`. Compare what the replay did with what the original did and what the task asked. Read and \`grep -r\` across those files with your own tools.`,
        '2. Record a cause for each task in the table:\n\n   ```\n   spotlight cause --task <task> --cause config|task|judge|check|infra --evidence <text | @file> [--suggestion <text | @file>]\n   ```\n\n   The evidence says what in the runs shows the cause: a step of the journal, a line of the diff, the verdict’s reasons. The suggestion says what a person, or the next iteration, should change. Recording a task’s cause again replaces the one before.',
        '3. If any task’s cause is `config`, the search goes on with at least one more iteration, which reads your causes, as long as its budget still covers it. If none is, the search ends, and the person who started it hears what you suggest fixing outside the config.',
        '4. End the run once every task has a cause.',
      ].join('\n'),
    ].join('\n\n');
  },
};
