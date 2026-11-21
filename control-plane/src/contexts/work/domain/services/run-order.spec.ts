import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { orderAt } from '@work/domain/services/run-order';
import type { BoundSecret } from '@work/domain/value-objects/bound-secret';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { describe, expect, it } from 'vitest';

const TRIAGE = StationId.of('station_1');

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: TRIAGE,
      key: StationKey.of('triage'),
      name: StationName.of('Triage'),
      position: 1,
      color: '#93a1b5',
      harness: HarnessId.of('dev'),
      profile: ProfileKey.of('linear'),
    }),
    stationOf({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const known = (
  name: string,
  awaitingValue: boolean,
  hosts: readonly string[] = [],
  entersSandbox = false,
): BoundSecret => ({
  name: SecretName.of(name),
  bindings: hosts.map((host) => ({
    host,
    location: 'header',
    name: 'authorization',
    sent: `Bearer ${SecretName.of(name).standIn}`,
  })),
  awaitingValue,
  entersSandbox,
});

const orderWith = (
  boundSecrets: readonly BoundSecret[],
  sandboxEnv: ReadyProfile['sandboxEnv'] = [],
) =>
  orderAt({
    at: { stationId: TRIAGE, resume: Resume.of({}), checkouts: [] },
    line: LINE,
    harnesses: HarnessCatalogue.of([HarnessId.of('dev')]),
    ready: [],
    profiles: [
      {
        key: ProfileKey.of('linear'),
        rules: [],
        mcpServers: [],
        native: {},
        secrets: [SecretName.of('STAGING_VIEWER')],
        sandboxEnv,
        injectedSecrets: [
          SecretName.of('LINEAR_API_KEY'),
          SecretName.of('STAGING_VIEWER'),
        ],
      },
    ],
    boundSecrets,
  });

const refusalsWith = (
  boundSecrets: readonly BoundSecret[],
  sandboxEnv: ReadyProfile['sandboxEnv'] = [],
) =>
  orderWith(boundSecrets, sandboxEnv)?.refusals.map((each) => each.description);

describe('orderAt', () => {
  it('refuses the run where a secret the profile injects has no value', () => {
    expect(refusalsWith([known('LINEAR_API_KEY', true)])).toEqual([
      'secret_awaiting_value: Secret LINEAR_API_KEY has no value. Station: Triage',
    ]);
  });

  it('refuses the run where a secret the profile puts in the sandbox does not allow it', () => {
    const appKey = [
      {
        variable: 'GITHUB_APP_PRIVATE_KEY',
        secret: SecretName.of('DEV_GITHUB_APP_KEY'),
      },
    ];

    expect(refusalsWith([known('DEV_GITHUB_APP_KEY', false)], appKey)).toEqual([
      'secret_kept_out_of_sandbox: Secret DEV_GITHUB_APP_KEY does not allow its value in a sandbox. Set sandbox = "env" on the secret. Station: Triage',
    ]);
    expect(
      refusalsWith([known('DEV_GITHUB_APP_KEY', false, [], true)], appKey),
    ).toEqual([]);
  });

  it('does not refuse the run for a secret the profile does not inject', () => {
    expect(refusalsWith([known('SENTRY_TOKEN', true)])).toEqual([]);
  });

  it('orders the secrets the profile names, with where each is bound, and not those its MCP servers get', () => {
    const viewer = known('STAGING_VIEWER', false, ['staging.example.com']);
    const linear = known('LINEAR_API_KEY', false, ['api.linear.app']);

    expect(
      orderWith([viewer, known('SENTRY_TOKEN', false), linear])?.boundSecrets,
    ).toEqual([viewer]);
  });
});
