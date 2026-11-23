import { dependenciesChanged } from '@replays/domain/services/dependency-reach';
import type {
  DependencyFacts,
  StationDependsOn,
} from '@replays/domain/value-objects/dependency-facts';
import { PlannedChanges } from '@replays/domain/value-objects/planned-changes.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const BUILD: StationDependsOn = {
  harnessProfile: 'careful',
  skills: ['tdd'],
  tools: ['linear.comment', 'pull-request', 'sentry.issues'],
};

const NONE: DependencyFacts = { hooks: [], onMarksAsPlanned: [], secrets: [] };

const reached = (
  changes: Parameters<typeof PlannedChanges.of>[0],
  facts: DependencyFacts = NONE,
  dependsOn: readonly StationDependsOn[] = [BUILD],
) => dependenciesChanged(dependsOn, PlannedChanges.of(changes), facts);

const hook = (key: string) => ({ key, lines: [], stations: [] });

describe('dependenciesChanged', () => {
  it('names the harness profile and skills the station depends on', () => {
    expect(
      reached({ harnessProfiles: ['careful', 'other'], skills: ['tdd', 'x'] }),
    ).toEqual([
      { kind: 'harness-profile', key: 'careful' },
      { kind: 'skill', key: 'tdd' },
    ]);
  });

  it('names an integration whose tools the station gets, that a hook firing at it calls, or that as planned enables tools on marks', () => {
    expect(
      reached(
        {
          integrations: [
            'linear',
            'sentry',
            'grafana',
            'lin',
            'github',
            'posthog',
          ].map((key) => ({ key, definition: null })),
        },
        {
          hooks: [{ key: 'notify', integrations: ['github'] }],
          onMarksAsPlanned: ['posthog'],
          secrets: [],
        },
      ),
    ).toEqual([
      { kind: 'integration', key: 'github' },
      { kind: 'integration', key: 'linear' },
      { kind: 'integration', key: 'posthog' },
      { kind: 'integration', key: 'sentry' },
    ]);
  });

  it('names a changed hook that may fire at the station', () => {
    expect(
      reached(
        { hooks: [hook('notify'), hook('elsewhere')] },
        {
          hooks: [{ key: 'notify', integrations: [] }],
          onMarksAsPlanned: [],
          secrets: [],
        },
      ),
    ).toEqual([{ kind: 'hook', key: 'notify' }]);
  });

  it('names a secret that something the station depends on carries', () => {
    const secret = (name: string) => SecretName.of(name);

    expect(
      reached(
        { secrets: ['A_KEY', 'B_KEY', 'C_KEY', 'D_KEY', 'E_KEY'] },
        {
          hooks: [{ key: 'notify', integrations: ['github'] }],
          onMarksAsPlanned: [],
          secrets: [
            {
              secret: secret('A_KEY'),
              carrier: 'harness-profile',
              key: 'careful',
            },
            { secret: secret('B_KEY'), carrier: 'integration', key: 'github' },
            { secret: secret('C_KEY'), carrier: 'skill', key: 'tdd' },
            { secret: secret('D_KEY'), carrier: 'skill', key: 'unlisted' },
            {
              secret: secret('E_KEY'),
              carrier: 'harness-profile',
              key: 'other',
            },
          ],
        },
      ),
    ).toEqual([
      { kind: 'secret', key: 'A_KEY' },
      { kind: 'secret', key: 'B_KEY' },
      { kind: 'secret', key: 'C_KEY' },
    ]);
  });

  it('counts the live station as well as the planned one', () => {
    expect(
      reached({ harnessProfiles: ['careful'] }, NONE, [
        { harnessProfile: null, skills: [], tools: [] },
        BUILD,
      ]),
    ).toEqual([{ kind: 'harness-profile', key: 'careful' }]);
  });
});
