import type {
  JournalStep,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import { fileChangesOf } from '@work/application/read-models/file-changes-of';
import { describe, expect, it } from 'vitest';

const step = (
  change: { path: string | null; before: string; after: string } | null,
): JournalStep => ({
  kind: 'tool',
  text: 'Edit',
  status: 'completed',
  tool: 'edit',
  detail: null,
  ms: 1,
  startedAt: new Date('2026-09-30T10:00:00Z'),
  locations: [],
  input: null,
  output: null,
  change,
});

const journal = (steps: JournalStep[]): RunJournal => ({
  runId: 'run_1',
  attempt: 1,
  steps,
  spans: [],
  ms: null,
  marks: {
    startedAt: null,
    readyAt: null,
    firstAgentUpdateAt: null,
    lastAgentUpdateAt: null,
    agentStoppedAt: null,
    endedAt: null,
  },
  spent: null,
  egressEnforcement: null,
});

describe('fileChangesOf', () => {
  it('keeps each file’s first text before and last text after the run', () => {
    expect(
      fileChangesOf(
        journal([
          step({ path: 'a.ts', before: 'one', after: 'two' }),
          step({ path: 'b.ts', before: '', after: 'new' }),
          step({ path: 'a.ts', before: 'two', after: 'three' }),
        ]),
      ),
    ).toEqual([
      { path: 'a.ts', before: 'one', after: 'three', omitted: false },
      { path: 'b.ts', before: '', after: 'new', omitted: false },
    ]);
  });

  it('leaves out the text of a file too large to send whole', () => {
    expect(
      fileChangesOf(
        journal([
          step({ path: 'big.json', before: '', after: 'x'.repeat(300_000) }),
        ]),
      ),
    ).toEqual([{ path: 'big.json', before: '', after: '', omitted: true }]);
  });

  it('leaves out a file that ends as it began, and changes to no path', () => {
    expect(
      fileChangesOf(
        journal([
          step({ path: 'a.ts', before: 'one', after: 'two' }),
          step({ path: 'a.ts', before: 'two', after: 'one' }),
          step({ path: null, before: 'x', after: 'y' }),
          step(null),
        ]),
      ),
    ).toEqual([]);
  });

  it('leaves out the text of files once a run’s changes have filled their allowance', () => {
    const large = 'x'.repeat(200_000);
    const changes = fileChangesOf(
      journal(
        Array.from({ length: 6 }, (_, at) =>
          step({ path: `file_${at}.ts`, before: '', after: large }),
        ),
      ),
    );

    expect(changes.map((each) => each.omitted)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });
});
