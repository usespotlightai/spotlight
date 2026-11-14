type SessionState = 'running' | 'needs-action' | 'idle';

export type AgentActivity =
  | 'working'
  | 'needs-action'
  | 'waiting-for-background';

export const agentActivityOf = (seen: {
  readonly stopped: boolean;
  readonly waitingForBackground: boolean;
  readonly session: SessionState | null;
}): AgentActivity | null => {
  if (seen.stopped || seen.session === null) {
    return null;
  }
  if (seen.waitingForBackground) {
    return 'waiting-for-background';
  }
  return seen.session === 'needs-action' ? 'needs-action' : 'working';
};
