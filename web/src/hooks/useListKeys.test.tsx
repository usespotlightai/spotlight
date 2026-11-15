import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CommandsProvider } from '@/components/shell/command/CommandsProvider';
import { useListKeys } from '@/hooks/useListKeys';

function List({ onClear }: { onClear?: () => void }) {
  const list = useRef<HTMLUListElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  useListKeys(list, onClear);

  return (
    <ul ref={list}>
      {['First', 'Second', 'Third'].map((name) => (
        <li key={name} data-list-item>
          <input
            type="checkbox"
            aria-label={`Select ${name}`}
            checked={picked.includes(name)}
            onChange={() => setPicked((was) => [...was, name])}
          />
          <a href={`/${name}`}>{name}</a>
        </li>
      ))}
      <li data-list-item inert>
        <a href="/hidden">Hidden</a>
      </li>
    </ul>
  );
}

const press = (key: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key });

const renderList = (onClear?: () => void) =>
  render(
    <CommandsProvider>
      <List onClear={onClear} />
    </CommandsProvider>,
  );

describe('useListKeys', () => {
  it('moves the focus down the list with J and up with K', () => {
    renderList();

    press('j');
    expect(screen.getByRole('link', { name: 'First' })).toHaveFocus();

    press('j');
    expect(screen.getByRole('link', { name: 'Second' })).toHaveFocus();

    press('k');
    expect(screen.getByRole('link', { name: 'First' })).toHaveFocus();
  });

  it('starts at the last item with K', () => {
    renderList();

    press('k');

    expect(screen.getByRole('link', { name: 'Third' })).toHaveFocus();
  });

  it('stops at the ends of the list and skips hidden items', () => {
    renderList();

    press('k');
    press('j');

    expect(screen.getByRole('link', { name: 'Third' })).toHaveFocus();
  });

  it('selects the focused item with X', () => {
    renderList();

    press('j');
    press('j');
    press('x');

    expect(
      screen.getByRole('checkbox', { name: 'Select Second' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Select First' }),
    ).not.toBeChecked();
  });

  it('selects nothing with X while no item has focus', () => {
    renderList();

    press('x');

    expect(
      screen.getByRole('checkbox', { name: 'Select First' }),
    ).not.toBeChecked();
  });

  it('clears the selection with Esc when the list has one', () => {
    const onClear = vi.fn();
    renderList(onClear);

    press('Escape');

    expect(onClear).toHaveBeenCalledOnce();
  });
});
