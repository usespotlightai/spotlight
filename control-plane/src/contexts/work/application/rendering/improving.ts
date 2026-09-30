import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';

export const Improving = {
  section(improving: ImprovedStation, lines: readonly Line[]): string {
    const held = lines.find((each) => each.id.equals(improving.lineId));
    const station = held?.stationAt(improving.stationId);

    if (!held || !station) {
      return [
        '## Improving a station',
        `The person opened this chat to improve the ${improving.stationName.value} station, but it is no longer on the team's lines. Tell them, and ask what they want to do instead.`,
      ].join('\n\n');
    }

    const line = held.key.value;
    const key = station.key.value;
    const folder = `.spotlight/history/${key}`;

    return [
      '## Improving a station',
      `The person wants the ${station.name.value} station (\`${key}\`) on the ${held.name.value} line (\`${line}\`) to do better. Work from what its runs actually did, not from guesses.`,
      `Write its recent runs to files first:\n\n\`\`\`\nspotlight history --line ${line} --station ${key} --last 30\n\`\`\``,
      `It prints where it wrote them: \`${folder}/index.md\` has one line per run with its config fingerprint, how it turned out and what it cost; \`configs/<fingerprint>.yml\` holds each config a run used; and each run has \`runs/<run>/journal.md\` (every step, tool call and output), \`outcome.json\` and, where it changed code, \`diff.patch\`. Narrow it with \`--outcome failed\` (or sent-back, refused, checks-failed, merged), \`--fingerprint <fp>\` or \`--since <date>\`. Read and \`grep -r\` across those files with your own tools; they are the one place you may write to.`,
      [
        'How to go about it:',
        '- Look at what changed between fingerprints, and whether outcomes moved with it, before blaming the model.',
        '- Propose one change at a time, or say why two changes cannot be separated.',
        '- Prefer adding to the config (more context in the prompt, a setup step, a skill) over rewriting how the prompt tells the agent to work.',
        '- Say which outcome would show the change worked: fewer runs sent back, checks passing, lower cost, and so on.',
      ].join('\n'),
      `You cannot change the station yourself. Your proposal is a change to the team's Terraform, which a person reviews and applies: show it as a unified diff of the station's block in the \`spotlight_line\` resource for \`${line}\` (\`prompt\`, \`harness\`, \`model\`, \`effort\`, \`profile\`, \`skills\`, \`tools\`) and of its prompt file, \`prompts/<team>/${line}/${key}.md\`. If the team's Terraform is not checked out, show the station block as it should read.`,
    ].join('\n\n');
  },
};
