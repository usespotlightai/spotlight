import { createHash } from 'node:crypto';

import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { RunOrder } from '@work/domain/services/run-order';
import { stationConfigOf } from '@work/domain/services/station-config-of';
import {
  judgeOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { describe, expect, it } from 'vitest';

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const LINE = {
  image: null,
  repositories: LineRepositories.none(),
} as unknown as LineMap;

const ORDER = {
  harness: HarnessId.of('claude-code'),
  model: null,
  effort: null,
  enabled: { profile: null, stationTools: [], toolsOnMarks: [], tools: [] },
} as unknown as RunOrder;

const CLAIMS = ['It changes only what the task requests.'];

const station = (
  over: Partial<Parameters<typeof stationOf>[0]> = {},
): Station =>
  stationOf({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: '#a3a8b0',
    ...over,
  });

const configured = (at: Station, order: RunOrder = ORDER) =>
  stationConfigOf({ station: at, line: LINE, order, folders: [] }, sha256);

describe('stationConfigOf', () => {
  it('configures the judge by the hash of its claims, sample and minimum agreement', () => {
    const judged = station({
      judge: judgeOf({
        claims: CLAIMS,
        sample: 0.2,
        minAgreement: 0.6,
      }),
    });

    expect(configured(judged).parts.judge).toEqual({
      rubricHash: sha256(JSON.stringify({ claims: CLAIMS, passThreshold: 1 })),
      sample: 0.2,
      minAgreement: 0.6,
    });
  });

  it('changes the judge’s hash when its claims or its pass threshold change', () => {
    const judgedBy = (passThreshold: number) =>
      configured(
        station({
          judge: judgeOf({
            claims: ['It retries.'],
            passThreshold,
            sample: 0.2,
            minAgreement: 0.6,
          }),
        }),
      ).parts.judge?.rubricHash;

    expect(judgedBy(1)).not.toBe(judgedBy(0.5));
    expect(judgedBy(1)).not.toBe(
      configured(
        station({
          judge: judgeOf({
            claims: CLAIMS,
            sample: 0.2,
            minAgreement: 0.6,
          }),
        }),
      ).parts.judge?.rubricHash,
    );
  });

  it('lists only the station’s tools, not those its task’s marks enable', () => {
    const PULL_REQUEST = Tool.of('pull-request');
    const ISSUE = Tool.of('sentry.get-issue');
    const unmarked = configured(station(), {
      ...ORDER,
      enabled: {
        profile: null,
        stationTools: [PULL_REQUEST],
        toolsOnMarks: [],
        tools: [PULL_REQUEST],
      },
    } as unknown as RunOrder);
    const marked = configured(station(), {
      ...ORDER,
      enabled: {
        profile: null,
        stationTools: [PULL_REQUEST],
        toolsOnMarks: [ISSUE],
        tools: [PULL_REQUEST, ISSUE],
      },
    } as unknown as RunOrder);

    expect(marked.parts.tools).toEqual(['pull-request']);
    expect(marked.fingerprint).toBe(unmarked.fingerprint);
  });

  describe('the secrets its profile has egress inject', () => {
    const profiled = (secrets: readonly string[]) =>
      configured(station(), {
        ...ORDER,
        enabled: {
          profile: {
            key: ProfileKey.of('careful'),
            rules: [],
            mcpServers: [],
            native: {},
            injectedSecrets: secrets.map((each) => SecretName.of(each)),
            sandboxEnv: [],
          },
          stationTools: [],
          toolsOnMarks: [],
          tools: [],
        },
      } as unknown as RunOrder);

    it('are part of the profile’s settings, even where it names none', () => {
      expect(profiled(['STAGING_VIEWER']).parts.profile?.settings).toEqual(
        expect.objectContaining({ injectedSecrets: ['STAGING_VIEWER'] }),
      );
      expect(profiled([]).parts.profile?.settings).toEqual(
        expect.objectContaining({ injectedSecrets: [] }),
      );
    });

    it('change the station’s config when they change', () => {
      expect(profiled(['STAGING_VIEWER']).fingerprint).not.toBe(
        profiled([]).fingerprint,
      );
    });
  });

  describe('the secrets its profile puts in the sandbox', () => {
    const profiled = (
      sandboxEnv: readonly { variable: string; secret: string }[],
    ) =>
      configured(station(), {
        ...ORDER,
        enabled: {
          profile: {
            key: ProfileKey.of('careful'),
            rules: [],
            mcpServers: [],
            native: {},
            injectedSecrets: [],
            sandboxEnv: sandboxEnv.map(({ variable, secret }) => ({
              variable,
              secret: SecretName.of(secret),
            })),
          },
          stationTools: [],
          toolsOnMarks: [],
          tools: [],
        },
      } as unknown as RunOrder);
    const APP_KEY = {
      variable: 'GITHUB_APP_PRIVATE_KEY',
      secret: 'DEV_GITHUB_APP_KEY',
    };

    it('are part of the profile’s settings, even where it names none', () => {
      expect(profiled([APP_KEY]).parts.profile?.settings).toEqual(
        expect.objectContaining({ sandboxEnv: [APP_KEY] }),
      );
      expect(profiled([]).parts.profile?.settings).toEqual(
        expect.objectContaining({ sandboxEnv: [] }),
      );
    });

    it('change the station’s config when they change', () => {
      expect(profiled([APP_KEY]).fingerprint).not.toBe(
        profiled([]).fingerprint,
      );
    });
  });

  it('configures no judge on a station without one', () => {
    expect(configured(station()).parts).not.toHaveProperty('judge');
  });
});
