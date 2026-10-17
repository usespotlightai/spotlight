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
  outcome: 'tunnelled',
  status: null,
  reason: null,
  trouble: null,
  at: at(10),
  ...over,
});

const NETWORKS: Record<
  string,
  Pick<RunNetworkResponseDto, 'egress' | 'connections'>
> = {
  run_retries_3: {
    egress: 'enforced',
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
        outcome: 'forwarded',
        bytesOut: 1_900,
        bytesIn: 7_400,
      }),
      connection('mcp.linear.app', {
        outcome: 'forwarded',
        bytesOut: 2_100,
        bytesIn: 3_300,
      }),
    ],
  },
  run_retries_2: {
    egress: 'not-enforced',
    connections: [
      connection('registry.npmjs.org', { bytesIn: 900_000 }),
      ...Array.from({ length: 3 }, (_, each) =>
        connection('paste.example.net', {
          outcome: 'blocked',
          reason: 'not-allowed',
          trouble: 'blocked',
          bytesOut: 0,
          bytesIn: 0,
          ms: 0,
          at: at(9 - each / 10),
        }),
      ),
      connection('mcp.linear.app', {
        outcome: 'forwarded',
        status: 401,
        trouble: 'refused',
        bytesOut: 1_200,
        bytesIn: 400,
      }),
    ],
  },
};

const WENT_WRONG: Record<string, TraceConnectionResponseDto[]> = {
  run_retries_2: [
    {
      host: 'paste.example.net',
      port: 443,
      outcome: 'blocked',
      status: null,
      reason: 'not-allowed',
      trouble: 'blocked',
      times: 3,
    },
    {
      host: 'mcp.linear.app',
      port: 443,
      outcome: 'forwarded',
      status: 401,
      reason: null,
      trouble: 'refused',
      times: 1,
    },
  ],
};

export const wentWrongIn = (runId: string): TraceConnectionResponseDto[] =>
  WENT_WRONG[runId] ?? [];

export const egressOf = (runId: string): RunNetworkResponseDto['egress'] =>
  NETWORKS[runId]?.egress ?? null;

export const runNetworkOf = (runId: string): RunNetworkResponseDto | null =>
  taskOfRun(runId)
    ? {
        runId,
        attempt: 1,
        ...(NETWORKS[runId] ?? { egress: null, connections: [] }),
      }
    : null;
