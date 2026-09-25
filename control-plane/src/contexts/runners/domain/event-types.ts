import { RunnerPoolDefined } from '@runners/domain/events/runner-pool-defined.event';
import { RunnerPoolRedefined } from '@runners/domain/events/runner-pool-redefined.event';
import { RunnerPoolRetired } from '@runners/domain/events/runner-pool-retired.event';
import { RunnerTrustDefined } from '@runners/domain/events/runner-trust-defined.event';
import { RunnerTrustRedefined } from '@runners/domain/events/runner-trust-redefined.event';
import { RunnerTrustWithdrawn } from '@runners/domain/events/runner-trust-withdrawn.event';
import { WorkspaceRunnersDeclared } from '@runners/domain/events/workspace-runners-declared.event';
import { WorkspaceRunnersDropped } from '@runners/domain/events/workspace-runners-dropped.event';
import { WorkspaceRunnersRedeclared } from '@runners/domain/events/workspace-runners-redeclared.event';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HarnessVersion } from '@runners/domain/value-objects/harness-version.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostImage } from '@runners/domain/value-objects/host-image.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolTokenStanding } from '@runners/domain/value-objects/pool-token-standing.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';

export const RUNNERS_EVENT_TYPES = [
  Admission,
  HarnessVersion,
  HostId,
  HostImage,
  HostReport,
  InstalledHarness,
  MaxRuns,
  PoolKey,
  PoolTokenStanding,
  RunnerWork,
  ProvisionSecret,
  ProvisionUrl,
  PullAccess,
  PushAccess,
  RunnerPoolChangeDetail,
  RunnerPoolId,
  RunnerLabels,
  RunnerTrustId,
  TrustKey,
  TrustedWorkload,
  WorkspaceRunnersId,
  RunnerPoolDefined,
  RunnerPoolRedefined,
  RunnerPoolRetired,
  RunnerTrustDefined,
  RunnerTrustRedefined,
  RunnerTrustWithdrawn,
  WorkspaceRunnersDeclared,
  WorkspaceRunnersDropped,
  WorkspaceRunnersRedeclared,
] as const;
