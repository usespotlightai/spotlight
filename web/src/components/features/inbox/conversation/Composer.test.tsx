import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '@/components/features/inbox/conversation/Composer';

const uploaded = vi.fn();

vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: uploaded }),
}));

const composer = (over: Partial<Parameters<typeof Composer>[0]> = {}) =>
  render(
    <Composer
      slug="acme"
      label="Say something to Triage"
      placeholder="Say something…"
      pending={false}
      onSend={vi.fn()}
      {...over}
    />,
  );

const box = () =>
  screen.getByRole('textbox', { name: 'Say something to Triage' });

const notes = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });

beforeEach(() => {
  uploaded.mockReset();
  uploaded.mockResolvedValue({ id: 'att_1' });
});

describe('Composer', () => {
  it('offers to send, not to stop, when nothing is running', () => {
    composer({ running: false, onStop: vi.fn() });

    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
  });

  it('offers to stop the agent while it works and the box is empty', () => {
    composer({ running: true, onStop: vi.fn() });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send' }),
    ).not.toBeInTheDocument();
  });

  it('becomes a send the moment something is typed, and a stop once cleared', async () => {
    const person = userEvent.setup();
    composer({ running: true, onStop: vi.fn() });

    await person.type(box(), 'wait, do this instead');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();

    await person.clear(box());
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('stops the agent when the stop button is pressed', async () => {
    const person = userEvent.setup();
    const onStop = vi.fn();
    composer({ running: true, onStop });

    await person.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('never offers to stop when it was given no way to', () => {
    composer({ running: true });

    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('sends a picked file along with what was typed', async () => {
    const person = userEvent.setup();
    const onSend = vi.fn();
    const { container } = composer({ onSend });

    await person.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      notes(),
    );
    await person.type(box(), 'the log, attached');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(),
    );
    await person.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith(
      'the log, attached',
      ['att_1'],
      expect.any(Function),
    );
  });

  it('sends a pasted file with nothing typed at all', async () => {
    const person = userEvent.setup();
    const onSend = vi.fn();
    composer({ onSend });

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(),
    );
    await person.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSend).toHaveBeenCalledWith('', ['att_1'], expect.any(Function));
  });

  it('takes a file dropped onto it', async () => {
    composer();

    fireEvent.drop(box(), {
      dataTransfer: { files: [notes()], types: ['Files'] },
    });

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();
    expect(uploaded).toHaveBeenCalledTimes(1);
  });

  it('holds the send while a file is still going up', async () => {
    const person = userEvent.setup();
    uploaded.mockReturnValue(new Promise(() => {}));
    composer({ running: true, onStop: vi.fn() });

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    await person.type(box(), 'and this');

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('has nothing to send for a file too large to upload', () => {
    composer();
    const large = notes();
    Object.defineProperty(large, 'size', { value: 26 * 1024 * 1024 });

    fireEvent.paste(box(), { clipboardData: { files: [large] } });

    expect(screen.getByText('Larger than 25 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('lets an attached file be taken off again', async () => {
    const person = userEvent.setup();
    composer();

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    await person.click(
      await screen.findByRole('button', { name: 'Remove notes.txt' }),
    );

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });

  it('forgets the words and the files once they are sent', async () => {
    const person = userEvent.setup();
    composer({ onSend: (_body, _attachments, sent) => sent() });

    fireEvent.paste(box(), { clipboardData: { files: [notes()] } });
    await person.type(box(), 'here');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(),
    );
    await person.click(screen.getByRole('button', { name: 'Send' }));

    expect(box()).toHaveValue('');
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });
});
