import { DependencyFactsReader } from '@replays/infrastructure/acl/dependency-facts.adapter';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STATION = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  teamKey: 'core',
  lineKey: 'delivery',
  stationKey: 'build',
};

describe('DependencyFactsReader', () => {
  it('reads the hooks that may fire at the station, and the team’s profiles, integrations and skills that carry each secret', async () => {
    const asked: unknown[] = [];
    const planned = [{ key: 'notify', lines: [], stations: ['build'] }];
    const reader = new DependencyFactsReader(
      {
        register: () => {},
        of: async (secret) => {
          asked.push(secret);
          return secret.name === 'API_KEY'
            ? [
                {
                  kind: 'harness-profile',
                  key: 'core/careful',
                  exposes: false,
                },
                {
                  kind: 'harness-profile',
                  key: 'core-two/careful',
                  exposes: false,
                },
                { kind: 'integration', key: 'core/linear', exposes: false },
                { kind: 'hook', key: 'core/notify', exposes: false },
              ]
            : [];
        },
      },
      {
        skills: async () => [{ key: 'tdd', secrets: ['TDD_KEY'] }],
        hooksAt: async (_team, station, hooks) => {
          asked.push({ station, hooks });
          return [{ key: 'notify', integrations: ['linear'] }];
        },
        enablingToolsOnMarks: async (integrations) => {
          asked.push({ integrations });
          return ['posthog'];
        },
      },
    );
    const API_KEY = SecretName.of('API_KEY');
    const TDD_KEY = SecretName.of('TDD_KEY');

    expect(
      await reader.of(STATION, [API_KEY, TDD_KEY], planned, [
        { key: 'posthog', definition: {} },
      ]),
    ).toEqual({
      hooks: [{ key: 'notify', integrations: ['linear'] }],
      onMarksAsPlanned: ['posthog'],
      secrets: [
        { secret: API_KEY, carrier: 'harness-profile', key: 'careful' },
        { secret: API_KEY, carrier: 'integration', key: 'linear' },
        { secret: TDD_KEY, carrier: 'skill', key: 'tdd' },
      ],
    });
    expect(asked).toEqual([
      { station: STATION, hooks: planned },
      { integrations: [{ key: 'posthog', definition: {} }] },
      { workspaceId: 'ws_1', name: 'API_KEY' },
      { workspaceId: 'ws_1', name: 'TDD_KEY' },
    ]);
  });
});
