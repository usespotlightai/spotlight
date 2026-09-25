import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerPoolDefined } from '@runners/domain/events/runner-pool-defined.event';
import { RunnerPoolRedefined } from '@runners/domain/events/runner-pool-redefined.event';
import { RunnerPoolRetired } from '@runners/domain/events/runner-pool-retired.event';
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
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerChangeDetail } from '@runners/domain/value-objects/runner-change-detail.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';

export const RUNNERS_EVENT_TYPES = [
  InstalledHarness,
  MaxRuns,
  PoolKey,
  PoolWork,
  ProvisionSecret,
  ProvisionUrl,
  PullAccess,
  PushAccess,
  RunnerChangeDetail,
  RunnerPoolChangeDetail,
  RunnerPoolId,
  RunnerLabels,
  RunnerName,
  RunnerTrustId,
  TrustKey,
  TrustedWorkload,
  WorkspaceRunnersId,
  RunnerEnrolled,
  RunnerPoolDefined,
  RunnerPoolRedefined,
  RunnerPoolRetired,
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
