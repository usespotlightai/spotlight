import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';

const measured = (element: HTMLElement, sizes: Record<string, number>) => {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AutoGrowTextarea', () => {
  it('measures itself again once it is laid out, after starting collapsed', () => {
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

    render(<AutoGrowTextarea value="" rows={2} onChange={() => {}} />);
    const textarea = screen.getByRole('textbox');
    textarea.style.height = '0px';

    measured(textarea, { clientWidth: 600, clientHeight: 4, scrollHeight: 52 });
    notice();

    expect(textarea.style.height).toBe('52px');
  });

  it('keeps its own rows where it could not be measured, so its placeholder still shows', () => {
    render(
      <AutoGrowTextarea
        value=""
        rows={2}
        placeholder="Say something…"
        onChange={() => {}}
      />,
    );

    const textarea = screen.getByPlaceholderText('Say something…');
    expect(textarea.style.height).toBe('');
    expect(textarea).toHaveAttribute('rows', '2');
  });

  it('grows to what it holds where it can be measured', () => {
    const scrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 72,
    });

    try {
      render(
        <AutoGrowTextarea value={'one\ntwo\nthree'} onChange={() => {}} />,
      );

      expect(screen.getByRole('textbox').style.height).toBe('72px');
    } finally {
      if (scrollHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollHeight',
          scrollHeight,
        );
      }
    }
  });
});
