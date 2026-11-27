import {
  reasoningIn,
  spotlightCommandsIn,
} from '@work/domain/services/run-reasoning';
import { describe, expect, it } from 'vitest';

const kindOf = (step: Parameters<typeof reasoningIn>[0]) =>
  reasoningIn(step)?.kind ?? null;

describe('reasoning in a run’s journal', () => {
  it('is the messages, thoughts and plans of the agent', () => {
    expect(kindOf({ kind: 'message', text: 'Retrying once.' })).toBe('message');
    expect(kindOf({ kind: 'thought', text: 'A queue is overkill.' })).toBe(
      'thought',
    );
    expect(kindOf({ kind: 'planned', text: '1. Retry' })).toBe('planned');
  });

  it('is the note it handed its work over with', () => {
    expect(
      kindOf({
        kind: 'tool',
        text: '  spotlight   handover --next review --note "Retries once"',
      }),
    ).toBe('handover');
  });

  it('is what the agent told its team to remember, however the harness titles the command', () => {
    for (const text of [
      'spotlight remember --kind rationale --body "Retry once"',
      '`spotlight remember --kind rationale --body "Retry once"`',
      'cd api && spotlight remember --kind rationale --body "Retry once"',
    ]) {
      expect(kindOf({ kind: 'tool', text })).toBe('remember');
    }
    expect(
      kindOf({ kind: 'tool', text: 'spotlight recall uploads' }),
    ).toBeNull();
  });

  it('reads the command from the input of the tool when its title does not show it', () => {
    expect(
      reasoningIn({
        kind: 'tool',
        text: 'Terminal',
        input:
          '{"command":"spotlight remember --kind failure --body \\"CI flakes\\""}',
      }),
    ).toEqual({
      kind: 'remember',
      text: 'spotlight remember --kind failure --body "CI flakes"',
      commands: [
        {
          name: 'remember',
          argument: 'CI flakes',
          shown: 'spotlight remember --kind failure --body "CI flakes"',
        },
      ],
    });
  });

  it('names no command for a message, a thought or a plan', () => {
    expect(reasoningIn({ kind: 'message', text: 'Retrying once.' })).toEqual({
      kind: 'message',
      text: 'Retrying once.',
      commands: [],
    });
  });

  it('is the command the agent ran, not one it only mentions', () => {
    expect(
      kindOf({
        kind: 'tool',
        text: 'spotlight remember --kind rationale --body "Call `spotlight handover` last"',
      }),
    ).toBe('remember');
    expect(
      kindOf({
        kind: 'tool',
        text: 'git commit -m "doc `spotlight remember`"',
      }),
    ).toBeNull();
  });

  it('is never another command, a hook, or an empty message', () => {
    expect(kindOf({ kind: 'tool', text: 'npm test' })).toBeNull();
    expect(kindOf({ kind: 'tool', text: 'spotlight handovers' })).toBeNull();
    expect(
      kindOf({ kind: 'tool', text: 'grep -r "spotlight remember" docs' }),
    ).toBeNull();
    expect(kindOf({ kind: 'hook', text: 'lint passed' })).toBeNull();
    expect(kindOf({ kind: 'message', text: '   ' })).toBeNull();
  });
});

describe('the spotlight commands a script ran', () => {
  const ran = (script: string) =>
    spotlightCommandsIn(script).map(({ name, argument }) => ({
      name,
      argument,
    }));
  const shown = (script: string) =>
    spotlightCommandsIn(script).map((each) => each.shown);

  it('is each command alone, without the rest of the script it ran in', () => {
    expect(
      shown(
        [
          'cd api && spotlight remember --kind environment --body "No make; use npm ci --ignore-scripts | tail" 2>&1 | tail -2',
          "cat > /tmp/note.md <<'E'",
          'Notes',
          'E',
        ].join('\n'),
      ),
    ).toEqual([
      'spotlight remember --kind environment --body "No make; use npm ci --ignore-scripts | tail"',
    ]);
    expect(
      shown("spotlight forget M-2 --because 'Wrong; see #12' && echo done"),
    ).toEqual(["spotlight forget M-2 --because 'Wrong; see #12'"]);
    expect(shown('`spotlight handover --note "Retries once"`')).toEqual([
      'spotlight handover --note "Retries once"',
    ]);
    expect(
      shown(
        'spotlight remember --kind rationale \\\n  --body "Retry once" > /dev/null',
      ),
    ).toEqual(['spotlight remember --kind rationale --body "Retry once"']);
  });

  it('is every command of a script that ran several, in order', () => {
    expect(
      ran(
        [
          'spotlight remember --kind environment --body "npm ci fails; use --ignore-scripts." 2>&1',
          'spotlight remember --kind environment --body "Vitest globals are off."',
        ].join('\n'),
      ),
    ).toEqual([
      { name: 'remember', argument: 'npm ci fails; use --ignore-scripts.' },
      { name: 'remember', argument: 'Vitest globals are off.' },
    ]);
  });

  it('begins a command only where the shell can begin one', () => {
    expect(
      ran(
        [
          'cd api && spotlight remember --kind rationale --body "One"',
          'false || spotlight remember --kind rationale --body "Two"',
          'true; spotlight remember --kind rationale --body "Three"',
          'echo Four | spotlight remember --kind rationale --body -',
          'FORCE=1 spotlight remember --kind rationale --body "Five"',
          'if true; then spotlight remember --kind rationale --body "Six"; fi',
          'echo "$(spotlight remember --kind rationale --body Seven)"',
          'x=$(spotlight remember --kind rationale --body Eight)',
          'echo `spotlight remember --kind rationale --body Nine`',
        ].join('\n'),
      ).map((each) => each.argument),
    ).toEqual(['One', 'Two', 'Three', null, 'Five', 'Six', 'Eight', 'Nine']);
  });

  it('is never a command that a quoted body only names', () => {
    expect(
      ran(
        'spotlight remember --kind rationale --body "Run spotlight remember --body x; then spotlight forget M-1 --because y && spotlight handover"',
      ),
    ).toEqual([
      {
        name: 'remember',
        argument:
          'Run spotlight remember --body x; then spotlight forget M-1 --because y && spotlight handover',
      },
    ]);
    expect(
      ran(
        "spotlight remember --kind rationale --body 'Use `spotlight forget` | never && spotlight handover'",
      ).map((each) => each.name),
    ).toEqual(['remember']);
    expect(ran('grep -rn "spotlight remember" docs')).toEqual([]);
    expect(ran("echo 'x; spotlight remember --body y'")).toEqual([]);
    expect(ran('# spotlight remember --body "y"')).toEqual([]);
  });

  it('receives the body as the CLI does, without its quotes and escapes', () => {
    expect(
      ran(
        [
          "spotlight remember --kind failure --body 'It'\\''s flaky'",
          "spotlight remember --kind rationale --body 'Match \\d+ in paths'",
          'spotlight remember --kind rationale --body "Say \\"done\\" at \\\\ and \\d"',
          'spotlight remember --kind rationale --body=Unquoted\\ words',
          'spotlight remember --kind rationale -body "Single dash"',
        ].join('\n'),
      ).map((each) => each.argument),
    ).toEqual([
      "It's flaky",
      'Match \\d+ in paths',
      'Say "done" at \\ and \\d',
      'Unquoted words',
      'Single dash',
    ]);
  });

  it('reads an ANSI-C quoted body with its escapes, and the commands after it', () => {
    expect(
      ran(
        [
          "spotlight remember --kind failure --body $'It\\'s \\\"flaky\\\"\\n\\tat \\\\ night'",
          "spotlight remember --kind rationale --body 'Second'",
        ].join(' && '),
      ),
    ).toEqual([
      { name: 'remember', argument: 'It\'s "flaky"\n\tat \\ night' },
      { name: 'remember', argument: 'Second' },
    ]);
    expect(
      ran(
        "spotlight remember --kind failure --body $'\\x41\\u00e9\\101 \\U110000'",
      ),
    ).toEqual([{ name: 'remember', argument: 'AéA \\U110000' }]);
  });

  it('receives no body inline where the CLI reads it from stdin or the shell makes it', () => {
    expect(
      ran(
        [
          "spotlight remember --kind failure --body - <<'EOF'",
          'spotlight remember --kind failure --body "in the heredoc"',
          'EOF',
          'spotlight remember --kind failure --body /dev/stdin < note.md',
          'spotlight remember --kind failure < note.md',
          'spotlight remember --kind failure --body "$(cat note.md)"',
          'spotlight remember --kind failure --body "Uses $HOME"',
        ].join('\n'),
      ),
    ).toEqual([
      { name: 'remember', argument: null },
      { name: 'remember', argument: null },
      { name: 'remember', argument: null },
      { name: 'remember', argument: null },
      { name: 'remember', argument: null },
    ]);
  });

  it('tells a forget from a remember, and reads a handover’s note', () => {
    expect(
      ran(
        [
          'spotlight forget M-4 --because "Moved to Vitest."',
          'spotlight remember --kind environment --body "Tests run on Vitest." --scope team',
          'spotlight handover --next review --note "Retries once" --suggest merge',
        ].join(' && '),
      ),
    ).toEqual([
      { name: 'forget', argument: 'Moved to Vitest.' },
      { name: 'remember', argument: 'Tests run on Vitest.' },
      { name: 'handover', argument: 'Retries once' },
    ]);
  });
});

describe('the spotlight commands a script ran, where the shell makes their prose', () => {
  const ran = (script: string) =>
    spotlightCommandsIn(script).map(({ argument, shown }) => ({
      argument,
      shown,
    }));

  it('receives a heredoc read by cat in a quoted substitution, and finds the commands after it', () => {
    expect(
      ran(
        [
          "spotlight remember --kind x --body \"$(cat <<'EOF'",
          "Don't use make.",
          'EOF',
          ')" && spotlight remember --kind x --body "Second."',
        ].join('\n'),
      ),
    ).toEqual([
      {
        argument: "Don't use make.",
        shown: [
          "spotlight remember --kind x --body \"$(cat <<'EOF'",
          "Don't use make.",
          'EOF',
          ')"',
        ].join('\n'),
      },
      {
        argument: 'Second.',
        shown: 'spotlight remember --kind x --body "Second."',
      },
    ]);
  });

  it('expands an unquoted heredoc only where nothing in it needs the shell', () => {
    const body = (lines: readonly string[]) =>
      ran(
        [
          'spotlight remember --kind x --body "$(cat <<-EOF',
          ...lines,
          '\tEOF',
          ')"',
        ].join('\n'),
      ).map((each) => each.argument);

    expect(body(['\tCosts \\$5 at \\\\ most.', ''])).toEqual([
      'Costs $5 at \\ most.',
    ]);
    expect(body(['Lives in $HOME.'])).toEqual([null]);
    expect(
      ran(
        'spotlight remember --kind x --body "$(cat <<\'EOF\' | tr a b\nx\nEOF\n)"',
      ).map((each) => each.argument),
    ).toEqual([null]);
  });

  it('shows a command whole where it redirects in the middle, without its trailing redirections', () => {
    expect(
      ran(
        'spotlight remember --kind x 2>/dev/null --body "B" > out.txt 2>&1 <<\'EOF\'\nignored\nEOF',
      ),
    ).toEqual([
      {
        argument: 'B',
        shown: 'spotlight remember --kind x 2>/dev/null --body "B"',
      },
    ]);
  });

  it('decodes the control characters of an ANSI-C quoted body', () => {
    expect(
      ran("spotlight remember --kind x --body $'a\\cAb\\c?c\\cz'").map(
        (each) => each.argument,
      ),
    ).toEqual(['a\x01b\x7fc\x1a']);
  });
});

describe('the script a tool step ran', () => {
  const argumentsOf = (input: string) =>
    reasoningIn({ kind: 'tool', text: 'Bash', input })?.commands.map(
      (each) => each.argument,
    ) ?? null;

  it('is the command of its input even where the journal cut the input short', () => {
    const script = [
      'spotlight remember --kind rationale --body "First \\"quoted\\""',
      'spotlight remember --kind rationale --body Second',
      `spotlight remember --kind rationale --body "${'x'.repeat(5000)}"`,
    ].join(' && ');
    const input = JSON.stringify({ command: script }, null, 2).slice(0, 4000);

    expect(() => {
      JSON.parse(input);
    }).toThrow(/JSON/);
    expect(argumentsOf(input)).toEqual(['First "quoted"', 'Second', null]);
    expect(argumentsOf(input.slice(0, input.indexOf('Second') + 3))).toEqual([
      'First "quoted"',
      null,
    ]);
    expect(argumentsOf(input.slice(0, input.indexOf('\\"quoted') + 1))).toEqual(
      [null],
    );
  });

  it('is the script of a shell argv even where the journal cut it short', () => {
    const input = JSON.stringify(
      {
        command: [
          'bash',
          '-lc',
          `spotlight forget M-1 --because "R" && spotlight remember --kind x --body "B" && echo ${'z'.repeat(5000)}`,
        ],
      },
      null,
      2,
    ).slice(0, 4000);

    expect(argumentsOf(input)).toEqual(['R', 'B']);
    expect(
      argumentsOf(
        JSON.stringify(
          {
            command: [
              'bash',
              '-lc',
              `spotlight remember --kind x --body "B" && spotlight remember --kind x --body "${'z'.repeat(5000)}"`,
            ],
          },
          null,
          2,
        ).slice(0, 4000),
      ),
    ).toEqual(['B', null]);
  });

  it('is the argv of its input, run by a shell or on its own', () => {
    expect(
      argumentsOf(
        JSON.stringify({
          command: [
            'bash',
            '-lc',
            "cd api && spotlight remember --kind rationale --body 'Retry once'",
          ],
        }),
      ),
    ).toEqual(['Retry once']);
    expect(
      argumentsOf(
        JSON.stringify({
          command: [
            'spotlight',
            'remember',
            '--kind',
            'rationale',
            '--body',
            "It's one; not two",
          ],
        }),
      ),
    ).toEqual(["It's one; not two"]);
    expect(
      argumentsOf(
        JSON.stringify(
          {
            command: [
              'spotlight',
              'forget',
              'M-3',
              '--because',
              `Gone ${'y'.repeat(5000)}`,
            ],
          },
          null,
          2,
        ).slice(0, 4000),
      ),
    ).toEqual([null]);
  });
});
