import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { FilesUnder } from '@work/application/ports/work-run-lookup.port';

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const referencesUnder = (
  journal: RunJournal,
  under: FilesUnder,
): string[] => {
  const pattern = new RegExp(
    `${escaped(under.folder)}/(?:[^\\n"'\`&|;<>]*?/)?[\\w.-]+?${escaped(under.extension)}(?![\\w/-])`,
    'g',
  );
  const found = new Set<string>();

  for (const step of journal.steps) {
    if (step.kind !== 'tool') {
      continue;
    }

    const touched = [
      step.text,
      step.input ?? '',
      ...step.locations.map((each) => each.path),
    ];

    for (const text of touched) {
      for (const match of text.matchAll(pattern)) {
        found.add(match[0]);
      }
    }
  }

  return [...found];
};
