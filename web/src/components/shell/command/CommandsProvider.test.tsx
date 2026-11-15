import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandScope } from '@/components/shell/command/CommandScope';
import { CommandsProvider } from '@/components/shell/command/CommandsProvider';
import { useCommands } from '@/hooks/useCommands';
import { SEQUENCE_MS } from '@/lib/commands/keys';
import type { Command } from '@/lib/commands/registry';

function Commands({ commands }: { commands: readonly Command[] }) {
  useCommands(commands);
  return null;
}

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const press = (init: KeyboardEventInit, target: Element = document.body) =>
  fireEvent.keyDown(target, init);

describe('CommandsProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a command on its key and keeps the browser from acting on it', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'shortcuts.show', run }]} />
      </CommandsProvider>,
    );

    const handled = !press({ key: '?', shiftKey: true });

    expect(run).toHaveBeenCalledOnce();
    expect(handled).toBe(true);
  });

  it('runs a sequence when its second key comes in time', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'go.inbox', run }]} />
      </CommandsProvider>,
    );

    press({ key: 'g' });
    wait(SEQUENCE_MS - 100);
    press({ key: 'i' });

    expect(run).toHaveBeenCalledOnce();
  });

  it('forgets the first key of a sequence after a pause', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'go.inbox', run }]} />
      </CommandsProvider>,
    );

    press({ key: 'g' });
    wait(SEQUENCE_MS + 1);
    press({ key: 'i' });

    expect(run).not.toHaveBeenCalled();
  });

  it('takes a key that does not continue the sequence as a new start', () => {
    const next = vi.fn();
    render(
      <CommandsProvider>
        <Commands
          commands={[
            { id: 'go.inbox', run: vi.fn() },
            { id: 'list.next', run: next },
          ]}
        />
      </CommandsProvider>,
    );

    press({ key: 'g' });
    press({ key: 'j' });

    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    ['repeated', { repeat: true }],
    ['while text is composed', { isComposing: true }],
    ['with Command', { metaKey: true }],
    ['with Ctrl', { ctrlKey: true }],
    ['with Option', { altKey: true }],
  ])('ignores a single key %s', (_name, init) => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'sidebar.toggle', run }]} />
      </CommandsProvider>,
    );

    press({ key: '[', ...init });

    expect(run).not.toHaveBeenCalled();
  });

  it('ignores a key that something else handled', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'sidebar.toggle', run }]} />
      </CommandsProvider>,
    );
    const handled = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener('keydown', handled);

    press({ key: '[' });
    document.body.removeEventListener('keydown', handled);

    expect(run).not.toHaveBeenCalled();
  });

  it('leaves single keys to a text field, but not keys with Command', () => {
    const toggle = vi.fn();
    const palette = vi.fn();
    render(
      <CommandsProvider>
        <Commands
          commands={[
            { id: 'sidebar.toggle', run: toggle },
            { id: 'palette.open', run: palette },
          ]}
        />
        <input aria-label="Title" />
      </CommandsProvider>,
    );
    const field = screen.getByRole('textbox', { name: 'Title' });
    field.focus();

    press({ key: '[' }, field);
    press({ key: 'k', metaKey: true }, field);

    expect(toggle).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledOnce();
  });

  it('skips a command that is not usable now', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <Commands
          commands={[{ id: 'sidebar.toggle', run, enabled: () => false }]}
        />
      </CommandsProvider>,
    );

    press({ key: '[' });

    expect(run).not.toHaveBeenCalled();
  });

  it('gives the key to the command of the deeper scope', () => {
    const page = vi.fn();
    const row = vi.fn();
    render(
      <CommandsProvider>
        <Commands commands={[{ id: 'inbox.resolve', run: page }]} />
        <CommandScope active>
          <Commands commands={[{ id: 'inbox.resolve', run: row }]} />
        </CommandScope>
      </CommandsProvider>,
    );

    press({ key: 'e' });

    expect(row).toHaveBeenCalledOnce();
    expect(page).not.toHaveBeenCalled();
  });

  it('keeps the commands of an inactive scope out', () => {
    const run = vi.fn();
    render(
      <CommandsProvider>
        <CommandScope active={false}>
          <Commands commands={[{ id: 'inbox.resolve', run }]} />
        </CommandScope>
      </CommandsProvider>,
    );

    press({ key: 'e' });

    expect(run).not.toHaveBeenCalled();
  });

  it('stops a command once its component unmounts', () => {
    const run = vi.fn();
    const { rerender } = render(
      <CommandsProvider>
        <Commands commands={[{ id: 'inbox.resolve', run }]} />
      </CommandsProvider>,
    );

    rerender(<CommandsProvider>{null}</CommandsProvider>);
    press({ key: 'e' });

    expect(run).not.toHaveBeenCalled();
  });

  it('runs the latest version of a command', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <CommandsProvider>
        <Commands commands={[{ id: 'inbox.resolve', run: first }]} />
      </CommandsProvider>,
    );

    rerender(
      <CommandsProvider>
        <Commands commands={[{ id: 'inbox.resolve', run: second }]} />
      </CommandsProvider>,
    );
    press({ key: 'e' });

    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});
