import { agentActivityOf } from '@runs/domain/value-objects/agent-activity.vo';
import { describe, expect, it } from 'vitest';

const seen = (
  over: Partial<Parameters<typeof agentActivityOf>[0]> = {},
): Parameters<typeof agentActivityOf>[0] => ({
  stopped: false,
  waitingForBackground: false,
  session: 'running',
  ...over,
});

describe('agentActivityOf', () => {
  it('says the agent works while its session runs', () => {
    expect(agentActivityOf(seen())).toBe('working');
  });

  it('says the agent needs a person while its session waits for an action', () => {
    expect(agentActivityOf(seen({ session: 'needs-action' }))).toBe(
      'needs-action',
    );
  });

  it('says the run waits for background work only while the runner waits for it', () => {
    expect(agentActivityOf(seen({ session: 'idle' }))).toBe('working');
    expect(
      agentActivityOf(seen({ session: 'idle', waitingForBackground: true })),
    ).toBe('waiting-for-background');
  });

  it('says nothing once the agent stopped or for a harness that reports no session', () => {
    expect(agentActivityOf(seen({ stopped: true }))).toBeNull();
    expect(agentActivityOf(seen({ session: null }))).toBeNull();
  });
});
