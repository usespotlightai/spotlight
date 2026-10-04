import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HarnessLogo } from '@/components/features/stations/HarnessLogo';

const drawn = () => document.querySelector('svg');

describe('HarnessLogo', () => {
  it('draws Claude Code in Claude’s colour', () => {
    render(<HarnessLogo harness="claude-code" />);

    expect(drawn()).toHaveAttribute('data-harness', 'claude-code');
    expect(drawn()).toHaveAttribute('fill', '#D97757');
  });

  it('draws Cursor in the text colour, so it shows on either theme', () => {
    render(<HarnessLogo harness="cursor" />);

    expect(drawn()).toHaveAttribute('data-harness', 'cursor');
    expect(drawn()).toHaveAttribute('fill', 'currentColor');
  });

  it('draws Codex as OpenAI’s mark in the text colour', () => {
    render(<HarnessLogo harness="codex" />);

    expect(drawn()).toHaveAttribute('data-harness', 'codex');
    expect(drawn()).toHaveAttribute('fill', 'currentColor');
  });

  it('draws Gemini in Gemini’s colour', () => {
    render(<HarnessLogo harness="gemini" />);

    expect(drawn()).toHaveAttribute('data-harness', 'gemini');
    expect(drawn()).toHaveAttribute('fill', '#8E75B2');
  });

  it('falls back to a plain mark for a harness it has no logo for', () => {
    render(<HarnessLogo harness="opencode" />);

    expect(drawn()).not.toHaveAttribute('data-harness');
  });
});
