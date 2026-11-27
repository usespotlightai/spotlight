import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { write } from '@/test/lexical';

const LINES = 'QUESTION 1: Which repository?\nQUESTION 2: Which channel?';

const shown = (keepLineBreaks?: boolean) => {
  render(
    <MarkdownEditor
      readOnly
      keepLineBreaks={keepLineBreaks}
      initialValue={LINES}
      placeholder=""
      ariaLabel="Note"
    />,
  );

  return screen.getByRole('textbox', { name: 'Note' });
};

describe('MarkdownEditor', () => {
  it('flows hard-wrapped lines into one paragraph when it is read-only', () => {
    const text = shown();

    expect(text.querySelector('br')).toBeNull();
    expect(text).toHaveTextContent(
      'QUESTION 1: Which repository? QUESTION 2: Which channel?',
    );
  });

  it('keeps each line on its own line when it keeps line breaks', () => {
    expect(shown(true).querySelectorAll('br')).toHaveLength(1);
  });

  const editing = (initialValue: string) => {
    const onChange = vi.fn<(markdown: string) => void>();
    render(
      <MarkdownEditor
        initialValue={initialValue}
        onChange={onChange}
        placeholder=""
        ariaLabel="Description"
      />,
    );

    return {
      editor: screen.getByRole('textbox', { name: 'Description' }),
      written: () => onChange.mock.lastCall?.[0],
    };
  };

  it('does not add a second bullet when a dash is typed in a bullet list', async () => {
    const { editor, written } = editing('- first\n- ');

    await write(editor, '-');
    await write(editor, ' ');
    await write(editor, 'item');

    expect(written()).toBe('- first\n- item');
  });

  it('does not add a second number when one is typed in a numbered list', async () => {
    const { editor, written } = editing('1. first\n2. ');

    await write(editor, '2.');
    await write(editor, ' ');
    await write(editor, 'item');

    expect(written()).toBe('1. first\n2. item');
  });

  it('keeps a dash typed later in a list item', async () => {
    const { editor, written } = editing('- first');

    await write(editor, ' - ');

    expect(written()).toBe('- first - ');
  });
});
