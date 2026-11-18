import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentWorking } from '@/components/features/agent/AgentWorking';
import type { JournalStep } from '@/lib/inbox';

const START = Date.parse('2026-09-14T09:00:00.000Z');

const running: JournalStep = {
  kind: 'tool',
  text: 'npm test',
  status: 'pending',
  tool: 'execute',
  detail: null,
  ms: 0,
  startedAt: '2026-09-14T09:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
};

describe('AgentWorking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prepares the workspace before the agent takes a step', () => {
    render(
      <AgentWorking
        harness="claude-code"
        progress="in-progress"
        phase={{ kind: 'preparing', key: 'run_1:preparing' }}
      />,
    );

    expect(screen.getByText('Preparing the workspace…')).toBeInTheDocument();
  });

  it('names the running step and counts the time seen on it once it runs long', () => {
    render(
      <AgentWorking
        harness="claude-code"
        progress="in-progress"
        phase={{ kind: 'step', step: running, key: 'run_1:step' }}
      />,
    );

    expect(screen.getByText('Running npm test…')).toBeInTheDocument();
    expect(screen.queryByText('4s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByText('4s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(63_000);
    });
    expect(screen.getByText('1m 7s')).toBeInTheDocument();
  });

  it('counts again from zero when the next step starts', () => {
    const { rerender } = render(
      <AgentWorking
        harness="claude-code"
        progress="in-progress"
        phase={{ kind: 'step', step: running, key: 'run_1:step' }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText('9s')).toBeInTheDocument();

    rerender(
      <AgentWorking
        harness="claude-code"
        progress="in-progress"
        phase={{ kind: 'working', key: 'run_1:working:2' }}
      />,
    );

    expect(screen.getByText('The agent is working…')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
  });

  it('keeps the queued words while the run waits for a runner', () => {
    render(
      <AgentWorking
        harness="claude-code"
        progress="queued"
        phase={{ kind: 'step', step: running, key: 'run_1:step' }}
      />,
    );

    expect(
      screen.getByText('Queued. The agent starts when a runner is free.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Running npm test…')).not.toBeInTheDocument();
  });
});
