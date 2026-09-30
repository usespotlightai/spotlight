import { describe, expect, it } from 'vitest';
import {
  type ConfigChange,
  changePhrase,
  shortFingerprint,
} from '@/lib/station-config';

const change = (over: Partial<ConfigChange>): ConfigChange => ({
  part: 'prompt',
  name: null,
  kind: 'changed',
  was: null,
  now: null,
  ...over,
});

describe('shortFingerprint', () => {
  it('keeps the first eight characters', () => {
    expect(shortFingerprint('3f2a9c1e5b7d4a60c8e2')).toBe('3f2a9c1e');
  });
});

describe('changePhrase', () => {
  it('says the prompt changed without repeating it', () => {
    expect(changePhrase(change({}))).toBe('Prompt changed');
    expect(changePhrase(change({ kind: 'added' }))).toBe('Prompt added');
    expect(changePhrase(change({ kind: 'removed' }))).toBe('Prompt removed');
  });

  it('says what a setting went from and to', () => {
    expect(
      changePhrase(change({ part: 'effort', was: 'high', now: 'xhigh' })),
    ).toBe('Effort high → xhigh');
  });

  it('says what a setting was set to, or which one was cleared', () => {
    expect(
      changePhrase(change({ part: 'model', kind: 'added', now: 'opus' })),
    ).toBe('Model set to opus');
    expect(
      changePhrase(change({ part: 'model', kind: 'removed', was: 'opus' })),
    ).toBe('Model opus removed');
  });

  it('shortens an image digest', () => {
    expect(
      changePhrase(
        change({
          part: 'image',
          was: 'node:22',
          now: `node:22@sha256:${'a'.repeat(64)}`,
        }),
      ),
    ).toBe('Image node:22 → node:22@sha256:aaaaaaaaaaaa');
  });

  it('names the skill, tool or repository that came or went', () => {
    expect(
      changePhrase(change({ part: 'skill', name: 'reviewing', kind: 'added' })),
    ).toBe('Skill reviewing added');
    expect(
      changePhrase(
        change({ part: 'tool', name: 'pull-request', kind: 'removed' }),
      ),
    ).toBe('Tool pull-request removed');
    expect(changePhrase(change({ part: 'skill', name: 'reviewing' }))).toBe(
      'Skill reviewing changed',
    );
  });

  it('says a repository’s setup changed', () => {
    expect(
      changePhrase(
        change({ part: 'repository', name: 'api', was: 'make', now: 'npm ci' }),
      ),
    ).toBe('Repository api setup changed');
  });

  it('says a profile’s settings changed where it kept its name', () => {
    expect(changePhrase(change({ part: 'profile', name: 'strict' }))).toBe(
      'Profile strict settings changed',
    );
    expect(
      changePhrase(change({ part: 'profile', was: 'loose', now: 'strict' })),
    ).toBe('Profile loose → strict');
  });

  it('says whether memories and decisions are on', () => {
    expect(
      changePhrase(change({ part: 'memories', was: 'off', now: 'on' })),
    ).toBe('Memories on');
    expect(
      changePhrase(change({ part: 'decisions', was: 'on', now: 'off' })),
    ).toBe('Decisions off');
  });
});
