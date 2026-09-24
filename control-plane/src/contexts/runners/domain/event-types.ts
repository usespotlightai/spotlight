import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRedefined } from '@runners/domain/events/runner-redefined.event';
import { RunnerRegistered } from '@runners/domain/events/runner-registered.event';
import { RunnerRekeyed } from '@runners/domain/events/runner-rekeyed.event';
import { RunnerReportedHarnesses } from '@runners/domain/events/runner-reported-harnesses.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { RunnerTrustDefined } from '@runners/domain/events/runner-trust-defined.event';
import { RunnerTrustRedefined } from '@runners/domain/events/runner-trust-redefined.event';
import { RunnerTrustWithdrawn } from '@runners/domain/events/runner-trust-withdrawn.event';
import { WorkspaceRunnersDeclared } from '@runners/domain/events/workspace-runners-declared.event';
import { WorkspaceRunnersDropped } from '@runners/domain/events/workspace-runners-dropped.event';
import { WorkspaceRunnersRedeclared } from '@runners/domain/events/workspace-runners-redeclared.event';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerChangeDetail } from '@runners/domain/value-objects/runner-change-detail.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';

export const RUNNERS_EVENT_TYPES = [
  InstalledHarness,
  RunnerChangeDetail,
  RunnerLabels,
  RunnerName,
  RunnerTrustId,
  TrustKey,
  TrustedWorkload,
  WorkspaceRunnersId,
  RunnerEnrolled,
  RunnerRedefined,
  RunnerRegistered,
  RunnerRekeyed,
  RunnerReportedHarnesses,
  RunnerRevoked,
  RunnerTrustDefined,
  RunnerTrustRedefined,
  RunnerTrustWithdrawn,
  WorkspaceRunnersDeclared,
  WorkspaceRunnersDropped,
  WorkspaceRunnersRedeclared,
] as const;
