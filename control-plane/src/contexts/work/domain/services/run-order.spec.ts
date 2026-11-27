import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { handoverOf, orderAt } from '@work/domain/services/run-order';
import type { TaskCheckout } from '@work/domain/services/task-checkouts';
import type { BoundSecret } from '@work/domain/value-objects/bound-secret';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineSource } from '@work/domain/value-objects/line-source.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { describe, expect, it } from 'vitest';

const TRIAGE = StationId.of('station_1');

const LINE_PARTS = {
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
};

const LINE = lineMapOf(LINE_PARTS);

const known = (
  name: string,
  awaitingValue: boolean,
  hosts: readonly string[] = [],
  allowsSandbox = false,
): BoundSecret => ({
  name: SecretName.of(name),
  bindings: hosts.map((host) => ({
    host,
    location: 'header',
    name: 'authorization',
    sent: `Bearer ${SecretName.of(name).standIn}`,
  })),
  awaitingValue,
  allowsSandbox,
});

const orderWith = (
  boundSecrets: readonly BoundSecret[],
  sandboxEnv: ReadyProfile['sandboxEnv'] = [],
  at: { checkouts?: readonly TaskCheckout[]; needsCheckout?: boolean } = {},
  line: LineMap = LINE,
) =>
  orderAt({
    at: {
      stationId: TRIAGE,
      resume: Resume.of({}),
      checkouts: at.checkouts ?? [],
      needsCheckout: at.needsCheckout,
    },
    line,
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
      'Secret LINEAR_API_KEY has no value yet. Set it on the Secrets settings page.',
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
      'Secret DEV_GITHUB_APP_KEY does not allow its value in a sandbox. Set sandbox = "env" on the secret.',
    ]);
    expect(
      refusalsWith([known('DEV_GITHUB_APP_KEY', false, [], true)], appKey),
    ).toEqual([]);
    expect(refusalsWith([known('DEV_GITHUB_APP_KEY', true)], appKey)).toEqual([
      'Secret DEV_GITHUB_APP_KEY does not allow its value in a sandbox. Set sandbox = "env" on the secret.',
      'Secret DEV_GITHUB_APP_KEY has no value yet. Set it on the Secrets settings page.',
    ]);
  });

  describe('a run that needs a checkout', () => {
    const refusalsAt = (
      at: {
        checkouts?: readonly TaskCheckout[];
        needsCheckout?: boolean;
      },
      line: LineMap = LINE,
    ) => orderWith([], [], at, line)?.refusals.map((each) => each.description);

    it('refuses the run where the line has no repository to check out, and says where to add one', () => {
      expect(refusalsAt({ needsCheckout: true })).toEqual([
        'The Delivery line has no repository yet. Add a `repository` block to the line’s `spotlight_line` in your team’s configuration. If the team has no configuration as code yet, start with “Set up configuration as code” on the setup checklist.',
      ]);
    });

    it('names the Terraform file that defines the line, where the team’s configuration says which', () => {
      const configured = lineMapOf({
        ...LINE_PARTS,
        source: LineSource.of({
          repository: Repository.of('acme/infra'),
          path: 'teams/core/delivery.tf',
        }),
      });

      expect(refusalsAt({ needsCheckout: true }, configured)).toEqual([
        'The Delivery line has no repository yet. Add a `repository` block to the line’s `spotlight_line` in `teams/core/delivery.tf` in acme/infra.',
      ]);
    });

    it('keeps the machine code of each refusal out of its words', () => {
      const refusals =
        orderWith([known('LINEAR_API_KEY', true)], [], { needsCheckout: true })
          ?.refusals ?? [];

      expect(refusals.map((each) => each.code)).toEqual([
        'line_has_no_repositories',
        'secret_awaiting_value',
      ]);
      for (const each of refusals) {
        expect(each.description).not.toContain(each.code);
        expect(each.description).not.toContain('Station:');
      }
    });

    it('does not refuse the run where it checks out a repository', () => {
      const widgets: TaskCheckout = {
        repository: Repository.of('acme/widgets'),
        branch: null,
        base: null,
        ref: null,
        diffOf: 'worktree',
        setup: null,
      };

      expect(refusalsAt({ needsCheckout: true, checkouts: [widgets] })).toEqual(
        [],
      );
    });

    it('does not refuse a run that needs no checkout', () => {
      expect(refusalsAt({})).toEqual([]);
    });
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

describe('handoverOf', () => {
  const ORDER = {
    options: LINE.optionsFrom(TRIAGE),
    resumeOptions: LINE.resumeOptionsAt(TRIAGE),
    noteLimit: 0,
  };
  const words = (options: readonly { readonly word: string }[]) =>
    options.map((each) => each.word);

  it('offers the line run where it may hand over, and nothing to resume', () => {
    const handover = handoverOf(ORDER, false);

    expect(handover.options).toEqual(ORDER.options);
    expect(handover.resumeOptions).toEqual([]);
  });

  it('offers a person’s turn no handover, only where the line resumes', () => {
    const handover = handoverOf(ORDER, true);

    expect(handover.options).toEqual([]);
    expect(words(handover.resumeOptions)).toEqual(['triage', 'done']);
  });
});
