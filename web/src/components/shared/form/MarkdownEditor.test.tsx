import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';

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
});
