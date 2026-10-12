import type { EvidencedHunk } from '@work/application/ports/run-evidence.port';

const MOST_ANSWER = 60_000;

const ANSWER = '## The answer';

const quoted = (text: string): string =>
  text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

const hunkOf = (hunk: EvidencedHunk): string =>
  [`--- ${hunk.path}`, hunk.header, ...hunk.lines].join('\n');

const clipped = (text: string): string =>
  text.length > MOST_ANSWER ? `${text.slice(0, MOST_ANSWER)}\n…` : text;

const wholeHunks = (hunks: readonly EvidencedHunk[]): string => {
  const told: string[] = [];
  let size = 0;

  for (const hunk of hunks) {
    const shown = hunkOf(hunk);

    if (size + shown.length > MOST_ANSWER && told.length > 0) {
      return [...told, `… ${hunks.length - told.length} more hunks`].join('\n');
    }
    told.push(shown);
    size += shown.length + 1;
  }

  return told.join('\n');
};

export const Answered = {
  acceptedGiven(hunks: readonly EvidencedHunk[]): boolean {
    return hunks.length > 0;
  },

  sentBackGiven(feedback: readonly string[]): boolean {
    return feedback.length > 0;
  },

  accepted(hunks: readonly EvidencedHunk[]): string | null {
    if (!Answered.acceptedGiven(hunks)) {
      return null;
    }

    return [
      ANSWER,
      'People accepted this change for the task. Make the same change.',
      `\`\`\`diff\n${wholeHunks(hunks)}\n\`\`\``,
    ].join('\n\n');
  },

  sentBack(feedback: readonly string[]): string | null {
    if (!Answered.sentBackGiven(feedback)) {
      return null;
    }

    return [
      ANSWER,
      'A person sent an earlier attempt at this task back and said:',
      clipped(feedback.map(quoted).join('\n\n')),
      'Do the task so that it meets what they asked for.',
    ].join('\n\n');
  },
};
