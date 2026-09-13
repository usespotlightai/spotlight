import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { BUILT_IN_LINES } from '@domain/services/built-in-lines';
import { BUILT_IN_TOOLS } from '@domain/services/built-in-tools';
import { GitHubSource } from '@infrastructure/github/github.source';
import { describe, expect, it } from 'vitest';

const BUILT_IN_REACTIONS = BUILT_IN_LINES.flatMap((line) => line.reactions);
const BUILT_IN_STATIONS = BUILT_IN_LINES.flatMap((line) => line.stations);

const source = new GitHubSource(
  { signs: () => true },
  {} as unknown as WorkspaceConnections,
);

const raised = source.happenings.map((each) => each.happening.value);

describe('the words the built-in lines wait for', () => {
  it('are all words the GitHub source actually raises', () => {
    const fromGitHub = BUILT_IN_REACTIONS.filter(
      (each) => each.happening.source === source.key,
    ).map((each) => each.happening.value);

    expect(fromGitHub).not.toHaveLength(0);
    expect(raised).toEqual(expect.arrayContaining(fromGitHub));
  });

  it('are each waited for once on any one line', () => {
    for (const line of BUILT_IN_LINES) {
      const awaited = line.reactions.map((each) => each.happening.value);

      expect(new Set(awaited).size).toBe(awaited.length);
    }
  });
});

describe('what the built-in line tells its agents', () => {
  it('names no tool in a prompt that the station does not have', () => {
    for (const opening of BUILT_IN_STATIONS) {
      const prompt = opening.agentPrompt?.value ?? '';
      const named = BUILT_IN_TOOLS.map((each) => each.declared.tool)
        .filter((tool) => prompt.includes(`spotlight ${tool.value}`))
        .map((tool) => tool.value);
      const held = opening.tools.map((tool) => tool.value);

      expect(held).toEqual(expect.arrayContaining(named));
    }
  });

  it('gives every tool it hands out to a station that exists here', () => {
    const known = BUILT_IN_TOOLS.map((each) => each.declared.tool.value);

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
