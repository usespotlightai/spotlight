import type { Violation } from './known-violations';
import {
  contextOf,
  moduleSpecifiersOf,
  moduleTarget,
  sourceFiles,
  withoutExtension,
} from './source-index';

const WORK = 'contexts/work/';

const RUN_SIDE: readonly RegExp[] = [
  /^domain\/aggregates\/(run|network-call|starting-point-hold|workspace-archive)\.aggregate$/,
  /^domain\/events\/(run-(?!briefed\b)[a-z-]+|replay-run-usage-recorded|search-run-usage-recorded)\.event$/,
  /^domain\/repositories\/(run|network-call|starting-point-hold|workspace-archive)\.repository$/,
  /^domain\/exceptions\/((invalid-)?(run|network-call|starting-point|starting-point-hold|workspace-archive|harness)[a-z-]*|unknown-(run|network-call|harness|runner)|call-secrets-[a-z-]+|wrong-call-secrets-token|not-this-hosts-call|mixed-runner-images|not-allowed-in-(replay|search)|invalid-tokens|invalid-money|invalid-search-iteration)\.error$/,
  /^domain\/services\/(agent-spend|change-hunks|claim-order|harness-catalog|injected-by-egress|permission-plan|pool-choice|pool-fit|team-provisioning|tool-attribution|workspace-path|requester-of|policy-of)$/,
  /^domain\/value-objects\/(run-[a-z-]+|requeue-count|resume-key|resume|restored-archive|started-checkout|starting-point|archive-(digest|grantee|holder|size)|workspace-archive-id|network-call-id|network-request|network-response|calling-host|call-secrets-claim|claimant|harness|harness-name|harness-command|handover-report|spotlight-api-grant|tokens|money|step-kind|step-status|search-id|search-iteration)(\.vo)?$/,
  /^application\/commands\/handlers\/(append-run-journal|claim-host-call|claim-host-work|claim-run|complete-run|complete-sandbox-archive|complete-workspace-archive|enqueue-run|fetch-run-secrets|fetch-shared-run-secrets|grant-run-attachment-upload|grant-sandbox-archive|grant-workspace-archive|record-egress-connections|record-host-call-response|record-run-image|record-starting-point|redeem-call-secrets|renew-check-lease|renew-lease)\.handler$/,
  /^application\/commands\/(egress|host-call|runner|workspace-archive)\.commands$/,
  /^application\/queries\/handlers\/(active-runs|authorize-runner|host-requirements|list-harnesses|list-runner-activity|pool-queue|read-run-events|read-run-network|run-stop-requested|stored-sandbox-archive|stored-workspace-archive|watch-run)\.handler$/,
  /^application\/queries\/((egress|host|pool)\.queries|(list-harnesses|list-runner-activity|read-run-events|read-run-network|run-stop-requested|stored-workspace-archive|watch-run)\.query)$/,
  /^application\/services\/(claimed-work|claims-taken|egress-secret-fetches|hold-starting-points|hook-traces|network-calls|provision-failures|provision-work|purge-run-connections|remove-released-archives|run-leases|claim-gate|runner-leases|sandbox-archives|sandbox-leases|runs|run-facts)(\.service)?$/,
  /^application\/ports\/(archive-references|check-endings|content-hash|check-provisioning|check-work|harness-launch|harness-profile-review|harness-tool-names|hook-traces|network-calls|queued-placements|run-connections|run-event-reader|run-journal|run-spend-reader|run-stream|run-tools-reader|run-usage-reader|run-usage-writer|runner-activity-reader|sandbox-hosts|starting-point-holds|workspace-archive-store|runs|run-leases|run-facts|run-progress|run-turns|run-journals|run-usages|run-uploads)\.port$/,
  /^application\/contracts\/(run-spec|run-journal|harness-profile|least-runner-release|run-order)\.contract$/,
  /^application\/dto\/(egress-[a-z]+|harness|host-call|host-requirements|host|pool|run|run-network|run-watch|runner-activity|workspace-archive)\.dto$/,
  /^presentation\/http\/streaming\/stream-mark$/,
  /^application\/mappers\/(harness|run-spend)\.mapper$/,
  /^infrastructure\/(acp|harnesses|journal|streaming)\//,
  /^infrastructure\/telemetry\/run-gauges$/,
  /^infrastructure\/storage\/s3-workspace-archive\.store$/,
  /^infrastructure\/persistence\/drizzle\/placement-matches$/,
  /^infrastructure\/persistence\/drizzle\/ledgers\/(run-connections|run-journal|run-usages)\.ledger$/,
  /^infrastructure\/persistence\/drizzle\/readers\/(archive-references|queued-placements|run-event|run-journals|runner-activity|run-facts)(\.reader)?$/,
  /^infrastructure\/persistence\/drizzle\/repositories\/(run|network-call|starting-point-hold|workspace-archive)\.repository$/,
  /^infrastructure\/persistence\/drizzle\/schemas\/(run|run-connection|network-call|starting-point-hold|workspace-archive)\.schema$/,
  /^presentation\/http\/controllers\/(egress|harness|host-call-secrets|host-work|pool|run-stream|runner-activity|sandbox-archive|workspace-archive)\.controller$/,
  /^presentation\/http\/dto\/(egress|harness|harness-probe|host-call|host-claim|host-requirements|host|pool|run-network|runner-activity|workspace-archive)\.(request|response)\.dto$/,
  /^presentation\/http\/mappers\/(claimed-work|egress-secrets)\.http\.mapper$/,
  /^presentation\/workers\/(network-calls|provision-work|run-connections|run-leases|workspace-archives)\.worker$/,
];

const COMPOSITION: readonly RegExp[] = [
  /^work\.(wiring|module|startup)$/,
  /^infrastructure\/events\/work-payload-types$/,
  /^application\/services\/long-poll$/,
  /^presentation\/http\/(long-poll-shutdown|paging)$/,
];

const RUN_SIDE_PUBLISHED = /^application\/(ports|contracts|dto)\//;

const REGISTRY_PORTS =
  /^application\/ports\/(run-start-gates|archive-holders|run-requester-labels|run-viewers)\.port$/;

const SCHEMA = /^infrastructure\/persistence\/drizzle\/schemas\//;

type Side = 'run' | 'work' | 'composition';

const inWork = (path: string): string | null =>
  path.startsWith(WORK) ? withoutExtension(path.slice(WORK.length)) : null;

export const sideOf = (path: string): Side | null => {
  const local = inWork(path);

  if (local === null) {
    return null;
  }

  if (COMPOSITION.some((each) => each.test(local))) {
    return 'composition';
  }

  return RUN_SIDE.some((each) => each.test(local)) ? 'run' : 'work';
};

const crossingOf = (from: string, to: string): string | null => {
  const fromSide = sideOf(from);
  const toSide = sideOf(to);
  const target = inWork(to) as string;

  if (fromSide === 'run' && toSide === 'work') {
    return REGISTRY_PORTS.test(target) ? null : 'run side imports work side';
  }

  if (fromSide === 'work' && toSide === 'run') {
    return RUN_SIDE_PUBLISHED.test(target)
      ? null
      : 'work side imports run side internals';
  }

  return null;
};

export const runsSeamViolations = (): Violation[] =>
  sourceFiles('contexts/work').flatMap((file) => {
    const targets = [
      ...new Set(
        moduleSpecifiersOf(file)
          .map((specifier) => moduleTarget(file.path, specifier))
          .filter(
            (target): target is string =>
              target !== null && contextOf(target) === 'work',
          )
          .map((target) => target.replace(/\.ts$/, '')),
      ),
    ];
    const local = inWork(file.path) as string;
    const crossings = targets.flatMap((target): Violation[] => {
      const rule = crossingOf(file.path, `${target}.ts`);

      return rule
        ? [
            {
              key: `${rule}: ${local} -> ${inWork(`${target}.ts`)}`,
              at: file.path,
            },
          ]
        : [];
    });
    const schemaSides = new Set(
      targets
        .filter((target) => SCHEMA.test(inWork(`${target}.ts`) as string))
        .map((target) => sideOf(`${target}.ts`)),
    );
    const joinsBoth =
      !SCHEMA.test(local) &&
      sideOf(file.path) !== 'composition' &&
      schemaSides.has('run') &&
      schemaSides.has('work');

    return joinsBoth
      ? [
          ...crossings,
          {
            key: `reads both sides' schemas: ${local}`,
            at: file.path,
          },
        ]
      : crossings;
  });
