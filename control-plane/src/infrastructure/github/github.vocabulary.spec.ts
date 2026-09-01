import type { GitHubInstallations } from '@domain/repositories/workspace.repository';
import {
  BUILT_IN_REACTIONS,
  BUILT_IN_STATIONS,
} from '@domain/services/built-in-stations';
import { BUILT_IN_TOOLS } from '@domain/services/built-in-tools';
import { GitHubSource } from '@infrastructure/github/github.source';
import { describe, expect, it } from 'vitest';

const source = new GitHubSource(
  { signs: () => true },
  {} as unknown as GitHubInstallations,
);

const raised = source.happenings.map((each) => each.happening.value);

/**
 * The line and the source name the same words in two places, and nothing at
 * compile time makes them agree. A station waiting for a word its source
 * never raises would simply never react, and say nothing about why.
 */
describe('the words the built-in line waits for', () => {
  const awaited = BUILT_IN_REACTIONS.map((each) => each.happening.value);

  it('are all words the GitHub source actually raises', () => {
    expect(awaited).not.toHaveLength(0);
    expect(raised).toEqual(expect.arrayContaining(awaited));
  });

  it('are each waited for once', () => {
    expect(new Set(awaited).size).toBe(awaited.length);
  });
});

// A station telling its agent to run a command it has not been given would
// reach nothing: the runner raises only what the run was handed.
describe('what the built-in line tells its agents', () => {
  it('names no tool in a prompt that the station does not have', () => {
    for (const opening of BUILT_IN_STATIONS) {
      const prompt = opening.agentPrompt?.value ?? '';
      const named = BUILT_IN_TOOLS.map((each) => each.tool)
        .filter((tool) => prompt.includes(`spotlight ${tool.value}`))
        .map((tool) => tool.value);
      const held = opening.tools.map((tool) => tool.value);

      expect(held).toEqual(expect.arrayContaining(named));
    }
  });

  it('gives every tool it hands out to a station that exists here', () => {
    const known = BUILT_IN_TOOLS.map((each) => each.tool.value);

    for (const opening of BUILT_IN_STATIONS) {
      for (const tool of opening.tools) {
        expect(known).toContain(tool.value);
      }
    }
  });
});

describe('the words the GitHub source declares', () => {
  it('are each named by GitHub as their source', () => {
    for (const happening of source.happenings) {
      expect(happening.happening.source).toBe(source.key);
    }
  });

  it('each say how they read in a note', () => {
    for (const happening of source.happenings) {
      expect(happening.told.trim()).not.toBe('');
      expect(happening.label.trim()).not.toBe('');
    }
  });

  // What a person says needs what they said; what the world reports does not.
  it('count a comment and a review as a person speaking, and nothing else', () => {
    expect(
      source.happenings
        .filter((each) => each.spoken)
        .map((each) => each.happening.value)
        .sort(),
    ).toEqual([
      'github.pull_request.changes-requested',
      'github.pull_request.commented',
    ]);
  });

  it('name no word twice', () => {
    expect(new Set(raised).size).toBe(raised.length);
  });
});
