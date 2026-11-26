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
});

describe('the claims of the built-in judges', () => {
  const claims = BUILT_IN_STATIONS.flatMap((each) => each.judge?.claims ?? []);

  it('can each be met or failed by every run, so the judge gives a run the same verdict each time', () => {
    for (const claim of claims) {
      expect(claim).not.toMatch(/^(When|If|Where|Each finding of)\b/);
    }
  });
});
