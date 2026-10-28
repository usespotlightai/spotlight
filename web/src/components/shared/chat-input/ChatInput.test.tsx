import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/shared/chat-input/ChatInput';
import { erase, restore, snapshot, textOf, write } from '@/test/lexical';

const uploaded = vi.fn();

vi.mock('@/lib/upload-attachment', () => ({
  uploadAttachment: (input: unknown) => uploaded(input),
}));

type Enabled = Extract<ComponentProps<typeof ChatInput>, { pending: boolean }>;

const input = (over: Partial<Enabled> = {}) =>
  render(
    <ChatInput
      slug="acme"
      label="Message Triage"
      placeholder="Write a message…"
      pending={false}
      settings={null}
      onSend={vi.fn()}
      {...over}
    />,
  );

const box = () => screen.getByRole('textbox', { name: 'Message Triage' });

const send = () => screen.getByRole('button', { name: 'Send' });

const notes = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });

beforeEach(() => {
  uploaded.mockReset();
  uploaded.mockResolvedValue({ id: 'att_1' });
});

describe('ChatInput', () => {
  it('offers to send, not to stop, when nothing is running', () => {
    input({ running: false, onStop: vi.fn() });

    expect(send()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('offers to stop the agent while it works, and a send once something is typed', async () => {
    input({ running: true, onStop: vi.fn() });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    await write(box(), 'wait, do this instead');
    expect(send()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();

    await erase(box());
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('stops the agent when the stop button is pressed', async () => {
    const onStop = vi.fn();
    input({ running: true, onStop });

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('never offers to stop when it was given no way to', () => {
    input({ running: true });

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(send()).toBeInTheDocument();
  });

  it('shows the settings it was given beside the box, and what it was given below', () => {
    input({
      settings: <button type="button">Agent</button>,
      below: <button type="button">Repositories</button>,
    });

    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Repositories' }),
    ).toBeInTheDocument();
  });

  it('sends a pasted file inline with what was typed', async () => {
    const onSend = vi.fn();
    input({ onSend });

    await write(box(), 'the log, attached ');
    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });

    expect(await within(box()).findByText('notes.txt')).toBeInTheDocument();
    await waitFor(() => expect(send()).toBeEnabled());
    await userEvent.click(send());

    expect(onSend).toHaveBeenCalledWith(
      {
        body: 'the log, attached',
        attachments: ['att_1'],
        traces: [],
        targetStation: null,
      },
      expect.any(Function),
    );
  });

  it('sends a file only while it is in the message, even once put back', async () => {
    const onSend = vi.fn();
    input({ onSend });

    await write(box(), 'see ');
    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    expect(await within(box()).findByText('notes.txt')).toBeInTheDocument();
    await waitFor(() => expect(send()).toBeEnabled());
    const withFile = snapshot(box());

    await erase(box());

    expect(send()).toBeDisabled();

    await restore(box(), withFile);
    expect(await within(box()).findByText('notes.txt')).toBeInTheDocument();
    await userEvent.click(send());

    expect(onSend).toHaveBeenCalledWith(
      { body: 'see', attachments: ['att_1'], traces: [], targetStation: null },
      expect.any(Function),
    );
  });

  it('takes a file dropped onto it', async () => {
    input();

    fireEvent.drop(box(), {
      dataTransfer: { files: [notes()], types: ['Files'] },
    });

    expect(await within(box()).findByText('notes.txt')).toBeInTheDocument();
    expect(uploaded).toHaveBeenCalledTimes(1);
  });

  it('takes an image that a drag carries only as an item', async () => {
    input();
    const shot = new File(['png'], 'shot.png', { type: 'image/png' });

    const opened = fireEvent.drop(box(), {
      dataTransfer: {
        files: [],
        items: [{ kind: 'file', getAsFile: () => shot }],
        types: ['Files'],
      },
    });

    expect(opened).toBe(false);
    await waitFor(() => expect(uploaded).toHaveBeenCalledTimes(1));
  });

  it('keeps the browser from opening a dropped file it cannot read', () => {
    input();

    const opened = fireEvent.drop(box(), {
      dataTransfer: { files: [], items: [], types: ['Files'] },
    });

    expect(opened).toBe(false);
    expect(uploaded).not.toHaveBeenCalled();
  });

  it('blocks the send while a file is still going up', async () => {
    uploaded.mockReturnValue(new Promise(() => {}));
    input();

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    await write(box(), 'and this');

    expect(send()).toBeDisabled();
  });

  it('has nothing to send for a file too large to upload, and says why', async () => {
    input();
    const large = notes();
    Object.defineProperty(large, 'size', { value: 26 * 1024 * 1024 });

    fireEvent.paste(box(), { clipboardData: { files: [large] } });

    expect(
      (await within(box()).findByText('notes.txt')).closest(
        '[data-slot="chat-reference"]',
      ),
    ).toHaveAttribute('title', 'The file is too large. Maximum size: 25 MB');
    expect(send()).toBeDisabled();
  });

  it('clears the words and the files once they are sent', async () => {
    input({ onSend: (_message, sent) => sent() });

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    await write(box(), 'here');
    await waitFor(() => expect(send()).toBeEnabled());
    await userEvent.click(send());

    expect(textOf(box())).toBe('');
    expect(within(box()).queryByText('notes.txt')).toBeNull();
  });

  it('can be shown without being used', () => {
    render(
      <ChatInput
        slug="acme"
        label="Message Triage"
        placeholder="Write a message…"
        disabled
        settings={<button type="button">Agent</button>}
      />,
    );

    expect(box()).toHaveAttribute('contenteditable', 'false');
    expect(send()).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Agent' }).closest('[inert]'),
    ).not.toBeNull();
  });

  it('sits on one line, and opens out once what is written runs past it, and collapses back once it fits again', async () => {
    let notice: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notice = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    try {
      const { container } = input();
      const grid = () => container.querySelector('form > div') as HTMLElement;

      expect(grid()).not.toHaveAttribute('data-expanded');

      Object.defineProperty(box(), 'clientWidth', {
        configurable: true,
        value: 600,
      });
      await write(box(), 'one line\nand another');
      Object.defineProperty(box(), 'scrollHeight', {
        configurable: true,
        value: 48,
      });
      act(() => notice());

      expect(grid()).toHaveAttribute('data-expanded', 'true');

      act(() => notice());

      expect(grid()).toHaveAttribute('data-expanded', 'true');

      Object.defineProperty(box(), 'scrollHeight', {
        configurable: true,
        value: 24,
      });
      act(() => notice());

      expect(grid()).not.toHaveAttribute('data-expanded');

      await erase(box());

      expect(grid()).not.toHaveAttribute('data-expanded');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
