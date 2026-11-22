import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import { RunOrdersMapper } from '@work/application/mappers/run-orders.mapper';
import { describe, expect, it } from 'vitest';

const ORDER: RunOrderContract = {
  runId: 'run_1',
  workspaceId: 'ws_1',
  harness: 'claude-code',
  priority: 0,
  placement: { labelGroups: [], image: null },
  spec: {
    command: { executable: 'claude-agent-acp', args: [] },
    briefing: 'Fix the queue.',
    handover: { options: ['Review'], noteLimit: 4_000 },
    resume: {},
    services: [
      {
        name: 'db',
        image: 'postgres:17',
        env: [{ name: 'POSTGRES_PASSWORD', value: 'local' }],
        health: {
          test: ['CMD-SHELL', 'pg_isready'],
          intervalMs: 2000,
          timeoutMs: 1000,
          startPeriodMs: 0,
          retries: 5,
        },
        from: 'api/compose.yml',
      },
      {
        name: 'worker',
        image: 'acme/worker:1',
        command: ['node', 'worker.js'],
        dependsOn: ['db'],
        from: 'api/compose.yml',
      },
    ],
  },
  requester: {
    owner: 'work',
    kind: 'task',
    id: 'task_1',
    token: '2',
    team: 'team_1',
  },
  policy: {
    holdsTurn: true,
    gated: true,
    actsBeyondItself: true,
    asks: 'requester',
    listed: true,
    exclusive: true,
  },
  workingCopy: {
    key: 'work/task-task_1',
    rejoinable: true,
    restores: 'always',
  },
  restore: null,
  extensions: {},
  apiGrant: null,
  tags: { taskId: 'task_1' },
  line: null,
  refusal: null,
};

describe('RunOrdersMapper', () => {
  it('keeps the services of a stored order', () => {
    expect(
      RunOrdersMapper.toRunOrder(RunOrdersMapper.toDispatchOrder(ORDER)).spec,
    ).toEqual(ORDER.spec);
  });
});
