import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenInEditor } from '@/components/features/editor/OpenInEditor';
import { OpenInEditorRow } from '@/components/features/editor/OpenInEditorRow';

const task = { kind: 'task', id: 'task_1' } as const;

const connection = vi.hoisted(() => ({
  watched: [] as boolean[],
  answer: { data: undefined as boolean | undefined },
}));

vi.mock('@/hooks/api/useEditorConnection', () => ({
  useEditorConnection: (
    _target: unknown,
    _slug: string,
    since: number | null,
  ) => {
    connection.watched.push(since !== null);
    return connection.answer;
  },
}));

const VSCODE_LINK =
  'vscode://vscode-remote/ssh-remote+task-task_1.acme.spotlight/workspace';

const stayOnPage = (event: MouseEvent) => event.preventDefault();

beforeEach(() => {
  connection.watched = [];
  connection.answer = { data: undefined };
  localStorage.clear();
  document.addEventListener('click', stayOnPage);
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  document.removeEventListener('click', stayOnPage);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const presentations = [
  ['OpenInEditor', () => render(<OpenInEditor slug="acme" target={task} />)],
  [
    'OpenInEditorRow',
    () => render(<OpenInEditorRow slug="acme" target={task} />),
  ],
] as const;

describe.each(presentations)('%s', (name, renderControl) => {
  it('links the workspace of the task in VS Code', () => {
    renderControl();

    expect(
      screen.getByRole('link', { name: 'Open in VS Code' }),
    ).toHaveAttribute('href', VSCODE_LINK);
  });

  it('shows the setup when the page keeps the focus after the click', () => {
    vi.useFakeTimers();
    renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    expect(screen.queryByText('Set up this computer once')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.getByText('Set up this computer once')).toBeInTheDocument();
    expect(
      screen.getByText(/If VS Code did not open, this computer needs/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy: Configure SSH' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`spotlight ssh setup --url ${window.location.origin}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy: Add to the VS Code settings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('"remote.SSH.connectTimeout": 600'),
    ).toBeInTheDocument();
  });

  it('shows no setup once the editor takes the focus', () => {
    vi.useFakeTimers();
    renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.queryByText('Set up this computer once')).toBeNull();
  });

  it('watches for the editor connection after the click only', () => {
    vi.useFakeTimers();
    renderControl();

    expect(connection.watched.every((each) => !each)).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));

    expect(connection.watched.at(-1)).toBe(true);
  });

  it('shows that the editor did not connect when no connection comes in 20 seconds', () => {
    vi.useFakeTimers();
    connection.answer = { data: false };
    renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(19_999);
    });
    expect(
      screen.queryByText('VS Code did not connect to Spotlight'),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(
      screen.getByText('VS Code did not connect to Spotlight'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If a Spotlight login page opened in your browser/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`spotlight login --url ${window.location.origin}`),
    ).toBeInTheDocument();
  });

  it('shows nothing once the editor connects', () => {
    vi.useFakeTimers();
    const { rerender } = renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(5_000);
    });
    connection.answer = { data: true };
    rerender(
      name === 'OpenInEditor' ? (
        <OpenInEditor slug="acme" target={task} />
      ) : (
        <OpenInEditorRow slug="acme" target={task} />
      ),
    );
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(
      screen.queryByText('VS Code did not connect to Spotlight'),
    ).toBeNull();
  });

  it('says nothing of the connection while Spotlight cannot answer', () => {
    vi.useFakeTimers();
    renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(30_000);
    });

    expect(
      screen.queryByText('VS Code did not connect to Spotlight'),
    ).toBeNull();
  });

  it('closes the setup once the editor connects after all', async () => {
    vi.useFakeTimers();
    const { rerender } = renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('Set up this computer once')).toBeInTheDocument();

    connection.answer = { data: true };
    rerender(
      name === 'OpenInEditor' ? (
        <OpenInEditor slug="acme" target={task} />
      ) : (
        <OpenInEditorRow slug="acme" target={task} />
      ),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(screen.queryByText('Set up this computer once')).toBeNull();
  });

  it('stops watching after 10 minutes and shows nothing then', () => {
    vi.useFakeTimers();
    const { rerender } = renderControl();

    fireEvent.click(screen.getByRole('link', { name: 'Open in VS Code' }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(5_000);
    });
    connection.answer = { data: true };
    rerender(
      name === 'OpenInEditor' ? (
        <OpenInEditor slug="acme" target={task} />
      ) : (
        <OpenInEditorRow slug="acme" target={task} />
      ),
    );
    connection.answer = { data: undefined };
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(connection.watched.at(-1)).toBe(false);
    expect(
      screen.queryByText('VS Code did not connect to Spotlight'),
    ).toBeNull();
  });
});

describe('OpenInEditorRow', () => {
  it('shows one row and reaches its editor menu from the keyboard', async () => {
    const user = userEvent.setup();
    render(<OpenInEditorRow slug="acme" target={task} />);

    await user.tab();
    expect(screen.getByRole('link', { name: 'Open in VS Code' })).toHaveFocus();
    expect(screen.queryByRole('link', { name: 'Open in Cursor' })).toBeNull();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Choose the editor' }),
    ).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(
      (await screen.findAllByRole('menuitem')).map((each) => each.textContent),
    ).toEqual(['Open in VS Code', 'Open in Cursor']);
  });

  it('remembers the editor chosen in its menu, in the row and the header button', async () => {
    const user = userEvent.setup();
    render(
      <>
        <OpenInEditorRow slug="acme" target={task} />
        <OpenInEditor slug="acme" target={task} />
      </>,
    );

    const [rowMenu] = screen.getAllByRole('button', {
      name: 'Choose the editor',
    });
    await user.click(rowMenu);
    await user.click(
      await screen.findByRole('menuitem', { name: 'Open in Cursor' }),
    );

    const links = screen.getAllByRole('link', { name: 'Open in Cursor' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        'cursor://vscode-remote/ssh-remote+task-task_1.acme.spotlight/workspace',
      );
    }
    expect(screen.queryByRole('link', { name: 'Open in VS Code' })).toBeNull();
    expect(localStorage.getItem('spotlight.editor-app')).toBe('cursor');
  });
});

describe('OpenInEditor', () => {
  it('lists both editors in its menu, and no setup item', async () => {
    const user = userEvent.setup();
    render(<OpenInEditor slug="acme" target={task} />);

    await user.click(screen.getByRole('button', { name: 'Choose the editor' }));

    expect(
      (await screen.findAllByRole('menuitem')).map((each) => each.textContent),
    ).toEqual(['Open in VS Code', 'Open in Cursor']);
  });

  it('opens the editor chosen last', async () => {
    localStorage.setItem('spotlight.editor-app', 'cursor');
    render(<OpenInEditor slug="acme" target={task} />);

    expect(
      screen.getByRole('link', { name: 'Open in Cursor' }),
    ).toHaveAttribute(
      'href',
      'cursor://vscode-remote/ssh-remote+task-task_1.acme.spotlight/workspace',
    );
  });
});
