import type {
  RunConnectionResponseDto,
  RunNetworkResponseDto,
  TraceConnectionResponseDto,
} from '@/lib/api';
import { taskOfRun } from '@/mocks/world';

const at = (minutesAgo: number): string =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

const connection = (
  host: string,
  over: Partial<RunConnectionResponseDto> = {},
): RunConnectionResponseDto => ({
  host,
  port: 443,
  bytesOut: 2_400,
  bytesIn: 48_000,
  ms: 120,
  outcome: 'passthrough',
  status: null,
  reason: null,
  error: null,
  at: at(10),
  ...over,
});

const NETWORKS: Record<
  string,
  Pick<RunNetworkResponseDto, 'egressEnforcement' | 'connections'>
> = {
  run_retries_3: {
    egressEnforcement: 'enforced',
    connections: [
      ...Array.from({ length: 14 }, (_, each) =>
        connection('registry.npmjs.org', {
          bytesIn: 180_000 + each * 9_000,
          at: at(11 - each / 10),
        }),
      ),
      connection('github.com', { bytesOut: 18_000, bytesIn: 2_600_000 }),
      connection('api.anthropic.com', {
        bytesOut: 310_000,
        bytesIn: 96_000,
        ms: 42_000,
      }),
      connection('mcp.linear.app', {
        outcome: 'injected',
        bytesOut: 1_900,
        bytesIn: 7_400,
      }),
      connection('mcp.linear.app', {
        outcome: 'injected',
        bytesOut: 2_100,
        bytesIn: 3_300,
      }),
    ],
  },
  run_retries_2: {
    egressEnforcement: 'not-enforced',
    connections: [
      connection('registry.npmjs.org', { bytesIn: 900_000 }),
      ...Array.from({ length: 3 }, (_, each) =>
        connection('paste.example.net', {
          outcome: 'blocked',
          reason: 'not-allowed',
          error: 'blocked',
          bytesOut: 0,
          bytesIn: 0,
          ms: 0,
          at: at(9 - each / 10),
        }),
      ),
      connection('mcp.linear.app', {
        outcome: 'injected',
        status: 401,
        error: 'auth-failed',
        bytesOut: 1_200,
        bytesIn: 400,
      }),
    ],
  },
};

const ERRORS: Record<string, TraceConnectionResponseDto[]> = {
  run_retries_2: [
    {
      host: 'paste.example.net',
      port: 443,
      outcome: 'blocked',
      status: null,
      reason: 'not-allowed',
      error: 'blocked',
      count: 3,
    },
    {
      host: 'mcp.linear.app',
      port: 443,
      outcome: 'injected',
      status: 401,
      reason: null,
      error: 'auth-failed',
      count: 1,
    },
  ],
};

export const errorsIn = (runId: string): TraceConnectionResponseDto[] =>
  ERRORS[runId] ?? [];

export const egressEnforcementOf = (
  runId: string,
): RunNetworkResponseDto['egressEnforcement'] =>
  NETWORKS[runId]?.egressEnforcement ?? null;

export const runNetworkOf = (runId: string): RunNetworkResponseDto | null =>
  taskOfRun(runId)
    ? {
        runId,
        attempt: 1,
        ...(NETWORKS[runId] ?? { egressEnforcement: null, connections: [] }),
      }
    : null;
