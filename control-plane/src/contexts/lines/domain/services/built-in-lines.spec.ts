import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { describe, expect, it } from 'vitest';

const BUILT_IN_STATIONS = BUILT_IN_LINES.flatMap((line) => line.stations);

describe('the words the built-in lines wait for', () => {
  it('are each waited for once on any one line', () => {
    for (const line of BUILT_IN_LINES) {
      const awaited = line.reactions.map((each) => each.happening.value);

      expect(new Set(awaited).size).toBe(awaited.length);
    }
  });
});

describe('the built-in stations', () => {
  it('give every station where agents work its change stacks, decisions and memories, and none to the others', () => {
    for (const opening of BUILT_IN_STATIONS) {
      const on = opening.kind === 'work';

      expect([opening.diffs, opening.decisions, opening.memories]).toEqual([
        on,
        on,
        on,
      ]);
    }
  });

  it('describe each station where agents work', () => {
    for (const opening of BUILT_IN_STATIONS) {
      expect(opening.description !== null).toBe(opening.kind === 'work');
    }
  });
});

describe('the built-in Delivery line', () => {
  const delivery = BUILT_IN_LINES.find((line) => line.key.value === 'delivery');
  const opening = (key: string) =>
    delivery?.stations.find((each) => each.key.value === key);
  const passes = (key: string) =>
    opening(key)?.passesTo.map((each) => each.value);

  it('lets code review send work back to spec or to implementation', () => {
    expect(passes('code-review')).toEqual(['spec', 'implementation']);
  });

  it('sends work back to implementation when its checks fail or its pull request conflicts', () => {
    const backTo = (happening: string) =>
      delivery?.reactions.find((each) => each.happening.value === happening)?.to
        .value;

    expect(backTo('github.checks.failed')).toBe('implementation');
    expect(backTo('github.pull_request.conflicted')).toBe('implementation');
  });

  it('lets implementation pass work on to code review, or back to spec', () => {
    expect(passes('implementation')).toEqual(['code-review', 'spec']);
  });

  it('tells implementation and code review when the fault is the spec’s to fix', () => {
    for (const key of ['implementation', 'code-review']) {
      expect(opening(key)?.agentPrompt?.value).toMatch(
        /spec turns out to be wrong|fault is in the plan/,
      );
      expect(opening(key)?.agentPrompt?.value).toContain('back to Spec');
    }
  });

  it('tells spec to revise its plan against the note work comes back with', () => {
    expect(opening('spec')?.agentPrompt?.value).toContain(
      'comes back from Implementation or Code Review',
    );
  });

  it('parks a task in the backlog when its pull request is closed without a merge', () => {
    const reaction = delivery?.reactions.find(
      (each) => each.happening.value === 'github.pull_request.closed-unmerged',
    );

    expect(reaction?.to.value).toBe('backlog');
  });

  it('tells code review to answer a question on the pull request instead of changing code', () => {
    const prompt = opening('code-review')?.agentPrompt?.value;

    expect(prompt).toMatch(/A\s+question is a question/);
    expect(prompt).toContain('you do not edit');
  });

  it('tells implementation to leave the pull request to code review', () => {
    expect(opening('implementation')?.agentPrompt?.value).toContain(
      'Do not open a pull request: Code Review opens it.',
    );
  });

  it('tells implementation and code review to run the app and load a page and its entry script, and to say so when they cannot', () => {
    for (const key of ['implementation', 'code-review']) {
      const prompt = opening(key)?.agentPrompt?.value;

      expect(prompt).toMatch(/dev or preview\s+server/);
      expect(prompt).toMatch(/Load a page or an endpoint/);
      expect(prompt).toMatch(/the entry script that page loads/);
      expect(prompt).toContain('curl -fsS');
      expect(prompt).toMatch(/say so in your note/);
    }
  });

  it('tells code review to follow the run instructions the change adds or changes', () => {
    expect(opening('code-review')?.agentPrompt?.value).toMatch(
      /run instructions that the change adds\s+or changes/,
    );
    expect(opening('code-review')?.judge?.claims).toContain(
      'The note has a line that names each run instruction the change adds or changes and what it did, or says it changes none.',
    );
  });

  it('has code review end its note with whether the app runs', () => {
    expect(opening('code-review')?.agentPrompt?.value).toContain(
      '    Runs: yes and what you loaded, or no and why.\n    Run instructions: none changed, or each one the change adds or changes and what it did.\n    Merges cleanly:',
    );
  });

  it('has the judges of implementation and code review check that the note says whether the app runs', () => {
    expect(opening('implementation')?.judge?.claims).toContain(
      'The note says whether the app ran, with what it loaded or why not.',
    );
    expect(opening('code-review')?.judge?.claims).toContain(
      'The note has a line that says whether the app runs, with what it loaded or why not.',
    );
  });

  it('tells implementation that an app that does not start is not done', () => {
    expect(opening('implementation')?.agentPrompt?.value).toMatch(
      /An app that does not start[\s\S]*is a\s+change that is not done/,
    );
  });

  it('tells code review to leave the workspace as it found it after running the app, and to count only what the change breaks', () => {
    const prompt = opening('code-review')?.agentPrompt?.value;

    expect(prompt).toMatch(/put back any file the run wrote/);
    expect(prompt).toMatch(/fails the same way without the change/);
    expect(prompt).toMatch(/nothing that deploys,\s+publishes/);
  });
});

describe('the claims of the built-in judges', () => {
  const claims = BUILT_IN_STATIONS.flatMap((each) => each.judge?.claims ?? []);

  it('can each be met or failed by every run, so the judge gives a run the same verdict each time', () => {
    for (const claim of claims) {
      expect(claim).not.toMatch(/^(When|If|Where|Each finding of)\b/);
    }
  });
});
