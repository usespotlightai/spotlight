import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import { referencesUnder } from '@work/application/services/journal-references';
import { describe, expect, it } from 'vitest';

const step = (over: Record<string, unknown>) => ({
  kind: 'tool',
  text: '',
  status: null,
  tool: null,
  detail: null,
  ms: 0,
  startedAt: new Date(),
  locations: [],
  input: null,
  output: null,
  change: null,
  ...over,
});

const journal = (steps: Record<string, unknown>[]) =>
  ({ runId: 'run_1', steps: steps.map(step) }) as unknown as RunJournal;

describe('what a run referred to under a folder', () => {
  it('finds the files a tool opened, by its title, its input and the locations it touched', () => {
    expect(
      referencesUnder(
        journal([
          { text: 'cat .spotlight/memory/team/M-3.md' },
          {
            text: 'Read',
            locations: [
              { path: '/workspace/.spotlight/memory/line/M-7.md', line: null },
            ],
          },
          {
            text: 'Terminal',
            input:
              '{"command":"cat .spotlight/memory/repositories/acme/web/app/(auth)/my file.ts/M-4.md"}',
          },
          {
            text: 'cat .spotlight/memory/repositories/acme/api/README.md/M-9.md && cat src/M-5.md',
          },
          {
            text: 'cat .spotlight/memory/repositories/acme/api/docs/M-3.md/M-12.md',
          },
        ]),
        '.spotlight/memory',
        /M-\d+\.md/,
      ),
    ).toEqual([
      '.spotlight/memory/team/M-3.md',
      '.spotlight/memory/line/M-7.md',
      '.spotlight/memory/repositories/acme/web/app/(auth)/my file.ts/M-4.md',
      '.spotlight/memory/repositories/acme/api/README.md/M-9.md',
      '.spotlight/memory/repositories/acme/api/docs/M-3.md/M-12.md',
    ]);
  });

  it('never counts what a tool merely listed', () => {
    expect(
      referencesUnder(
        journal([
          {
            text: 'find .spotlight/memory',
            output:
              '.spotlight/memory/team/M-3.md\n.spotlight/memory/line/M-7.md',
          },
          { text: 'grep -rl retry .spotlight/memory' },
        ]),
        '.spotlight/memory',
        /M-\d+\.md/,
      ),
    ).toEqual([]);
  });

  it('never reads the messages of the agent, only what its tools touched', () => {
    expect(
      referencesUnder(
        journal([
          { kind: 'message', text: 'See .spotlight/memory/team/M-3.md' },
        ]),
        '.spotlight/memory',
        /M-\d+\.md/,
      ),
    ).toEqual([]);
  });
});
