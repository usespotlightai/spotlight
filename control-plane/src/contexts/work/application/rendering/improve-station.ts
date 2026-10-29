import type { Line } from '@work/domain/aggregates/line.aggregate';
import { TEST_STATION_CHANGE } from '@work/domain/services/built-in-tools';
import type { TargetStation } from '@work/domain/value-objects/target-station.vo';

export const ImproveStation = {
  section(targetStation: TargetStation, lines: readonly Line[]): string {
    const improved = lines.find((each) => each.id.equals(targetStation.lineId));
    const station = improved?.stationAt(targetStation.stationId);

    if (!improved || !station) {
      return [
        '## Improving a station',
        `The person opened this chat to improve the ${targetStation.stationName.value} station, but it is no longer on the team's lines. Tell them, and ask what they want to do instead.`,
      ].join('\n\n');
    }

    const line = improved.key.value;
    const key = station.key.value;
    const folder = `.spotlight/history/${key}`;

    return [
      '## Improving a station',
      `The person wants the ${station.name.value} station (\`${key}\`) on the ${improved.name.value} line (\`${line}\`) to do better. Work from what its runs actually did, not from guesses.`,
      `Write its recent runs to files first:\n\n\`\`\`\nspotlight history --line ${line} --station ${key} --last 30\n\`\`\``,
      `It prints where it wrote them: \`${folder}/index.md\` has one line per run with its config fingerprint, how it turned out and what it cost; \`configs/<fingerprint>.yml\` contains each config a run used; and each run has \`runs/<run>/journal.md\` (every step, tool call and output), \`outcome.json\` and, where it changed code, \`diff.patch\`. Narrow it with \`--outcome failed\` (or sent-back, refused, checks-failed, merged), \`--fingerprint <fp>\` or \`--since <date>\`. Read and \`grep -r\` across those files with your own tools; they are the one place you may write to.`,
      [
        'How to go about it:',
        '- Look at what changed between fingerprints, and whether outcomes moved with it, before blaming the model.',
        '- Propose one change at a time, or say why two changes cannot be separated.',
        '- Prefer adding to the config (more context in the prompt, a setup step, a skill) over rewriting how the prompt tells the agent to work.',
        '- Say which outcome would show the change worked: fewer runs sent back, checks passing, lower cost, and so on.',
      ].join('\n'),
      [
        'Test your change, do not only describe it:',
        `- Propose one change. Write the changed station block as JSON, as the \`spotlight_line\` resource for \`${line}\` contains the station (\`prompt\`, \`harness\`, \`model\`, \`effort\`, \`profile\`, \`skills\`, \`tools\`).`,
        `- Call the tool. It replays the change against the live config, and the result arrives in the person's inbox:\n\n\`\`\`\nspotlight tools call ${TEST_STATION_CHANGE.value} --name <slug> --hypothesis "…" < station.json\n\`\`\``,
        '- The default mode is `test`: Spotlight replays only your change. Add `--mode search` only when the person asks for a search; the search agent then refines your change.',
        '- Tell the person what the tool answered: what happens next and that the result arrives in their inbox.',
      ].join('\n'),
      `You cannot change the station yourself. Show a Terraform diff only when the tool cannot start, and give its reason first. The diff is of the station's block in the \`spotlight_line\` resource for \`${line}\` and of its prompt file, \`prompts/<team>/${line}/${key}.md\`. A person reviews and applies it. If the team's Terraform is not checked out, show the station block as it should read.`,
    ].join('\n\n');
  },
};
