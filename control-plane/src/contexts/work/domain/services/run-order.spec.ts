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
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
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

const refusalsWith = (secretsAwaitingValue: readonly string[]) =>
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
        injectedSecrets: [SecretName.of('LINEAR_API_KEY')],
      },
    ],
    secretsAwaitingValue: secretsAwaitingValue.map((each) =>
      SecretName.of(each),
    ),
  })?.refusals.map((each) => each.description);

describe('orderAt', () => {
  it('refuses the run where a secret the profile injects has no value', () => {
    expect(refusalsWith(['LINEAR_API_KEY'])).toEqual([
      'secret_awaiting_value: Secret LINEAR_API_KEY has no value. Station: Triage',
    ]);
  });

  it('does not refuse the run for a secret the profile does not inject', () => {
    expect(refusalsWith(['SENTRY_TOKEN'])).toEqual([]);
  });
});
