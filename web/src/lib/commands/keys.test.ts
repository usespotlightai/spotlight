import { describe, expect, it } from 'vitest';

import { capsOf, chordOf, spokenOf, startsWith } from '@/lib/commands/keys';

const chord = (init: KeyboardEventInit) =>
  chordOf(new KeyboardEvent('keydown', init));

describe('chordOf', () => {
  it('names a letter in lower case, with Shift only when Shift is down', () => {
    expect(chord({ key: 'g' })).toBe('g');
    expect(chord({ key: 'G' })).toBe('g');
    expect(chord({ key: 'G', shiftKey: true })).toBe('shift+g');
  });

  it('takes Command and Ctrl as the same modifier', () => {
    expect(chord({ key: 'k', metaKey: true })).toBe('mod+k');
    expect(chord({ key: 'K', ctrlKey: true })).toBe('mod+k');
  });

  it('keeps Shift and Alt apart from Command', () => {
    expect(chord({ key: 'k', metaKey: true, shiftKey: true })).toBe(
      'mod+shift+k',
    );
    expect(chord({ key: 'k', ctrlKey: true, altKey: true })).toBe('mod+alt+k');
  });

  it('leaves Shift out of a symbol, as the symbol already shows it', () => {
    expect(chord({ key: '?', shiftKey: true })).toBe('?');
  });

  it('names the keys that have no character', () => {
    expect(chord({ key: 'Escape' })).toBe('escape');
    expect(chord({ key: 'Backspace', metaKey: true })).toBe('mod+backspace');
  });

  it('ignores a modifier pressed alone', () => {
    expect(chord({ key: 'Shift', shiftKey: true })).toBeNull();
    expect(chord({ key: 'Meta', metaKey: true })).toBeNull();
  });
});

describe('startsWith', () => {
  it('finds the start of a sequence', () => {
    expect(startsWith(['g', 'i'], ['g'])).toBe(true);
    expect(startsWith(['g', 'i'], ['g', 'i'])).toBe(true);
    expect(startsWith(['g', 'i'], ['i'])).toBe(false);
    expect(startsWith(['g'], ['g', 'i'])).toBe(false);
  });
});

describe('capsOf', () => {
  it('shows the symbols on a Mac', () => {
    expect(capsOf('mod+k', true)).toEqual(['⌘', 'K']);
    expect(capsOf('mod+backspace', true)).toEqual(['⌘', '⌫']);
    expect(capsOf('mod+enter', true)).toEqual(['⌘', 'Enter']);
  });

  it('shows the key names on other computers', () => {
    expect(capsOf('mod+k', false)).toEqual(['Ctrl', 'K']);
    expect(capsOf('mod+backspace', false)).toEqual(['Ctrl', 'Backspace']);
  });

  it('shows Esc and symbols as they are', () => {
    expect(capsOf('escape', true)).toEqual(['Esc']);
    expect(capsOf('?', false)).toEqual(['?']);
    expect(capsOf('[', false)).toEqual(['[']);
  });
});

describe('spokenOf', () => {
  it('names the keys of a chord', () => {
    expect(spokenOf(['mod+k'], true)).toBe('Command K');
    expect(spokenOf(['mod+k'], false)).toBe('Control K');
  });

  it('joins a sequence with then', () => {
    expect(spokenOf(['g', 'i'], true)).toBe('G, then I');
    expect(spokenOf(['?'], true)).toBe('Question mark');
  });
});
