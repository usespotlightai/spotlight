import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { runnerKeys } from '@/hooks/api/useRunners';
import type { HarnessResponseDto } from '@/lib/api';
import type { Runner } from '@/lib/runner';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';

const MINUTE = 60_000;

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * MINUTE).toISOString();

const harness = (id: string, name: string): HarnessResponseDto => ({
  id,
  name,
  models: [],
  defaultModel: '',
  efforts: [],
});

const HARNESSES: HarnessResponseDto[] = [
  harness('claude-code', 'Claude Code'),
  harness('cursor', 'Cursor'),
  harness('codex', 'Codex'),
  harness('gemini', 'Gemini CLI'),
];

const RUNNERS: Runner[] = [
  {
    id: 'runner_build_box',
    name: 'Build box',
    harnesses: ['claude-code', 'cursor'],
    registeredAt: minutesAgo(12 * 24 * 60),
    lastSeenAt: minutesAgo(0),
    revokedAt: null,
    connected: true,
    currentRun: { id: 'run_retries_2', state: 'running' },
  },
  {
    id: 'runner_laptop',
    name: 'Sam’s laptop',
    harnesses: ['claude-code'],
    registeredAt: minutesAgo(3 * 24 * 60),
    lastSeenAt: minutesAgo(2),
    revokedAt: null,
    connected: true,
    currentRun: null,
  },
  {
    id: 'runner_ci',
    name: 'CI runner',
    harnesses: ['claude-code', 'cursor', 'codex', 'gemini'],
    registeredAt: minutesAgo(30 * 24 * 60),
    lastSeenAt: minutesAgo(3 * 60),
    revokedAt: null,
    connected: false,
    currentRun: null,
  },
  {
    id: 'runner_staging',
    name: 'Staging',
    harnesses: [],
    registeredAt: minutesAgo(40),
    lastSeenAt: null,
    revokedAt: null,
    connected: false,
    currentRun: null,
  },
];

export const seedRunners = (client: QueryClient) => {
  client.setQueryData(runnerKeys.all, RUNNERS);
  client.setQueryData(harnessKeys.all, HARNESSES);
};

export const emptyRunners = (client: QueryClient) => {
  client.setQueryData(runnerKeys.all, []);
  client.setQueryData(harnessKeys.all, HARNESSES);
};

export const failRunners = (client: QueryClient) =>
  failQuery(client, runnerKeys.all);
