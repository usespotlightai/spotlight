import { EgressDefined } from '@runners/domain/events/egress-defined.event';
import { EgressRedefined } from '@runners/domain/events/egress-redefined.event';
import { EgressRetired } from '@runners/domain/events/egress-retired.event';
import { RunnerHostStartedServing } from '@runners/domain/events/runner-host-started-serving.event';
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
import { EgressChangeDetail } from '@runners/domain/value-objects/egress-change-detail.vo';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressToken } from '@runners/domain/value-objects/egress-token.vo';
import { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { HarnessVersion } from '@runners/domain/value-objects/harness-version.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostImage } from '@runners/domain/value-objects/host-image.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { HostSession } from '@runners/domain/value-objects/host-session.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolToken } from '@runners/domain/value-objects/pool-token.vo';
import { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { SealedProvisionSecret } from '@runners/domain/value-objects/sealed-provision-secret.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';

export const RUNNERS_PAYLOAD_TYPES = [
  Admission,
  EgressChangeDetail,
  EgressId,
  EgressKey,
  EgressReference,
  EgressTraffic,
  EgressToken,
  EgressTokenUsage,
  EgressUrl,
  HarnessVersion,
  HostId,
  HostImage,
  HostReport,
  HostSession,
  InstalledHarness,
  MaxRuns,
  PoolKey,
  PoolToken,
  PoolTokenUsage,
  RunnerWork,
  ProvisionSecret,
  ProvisionUrl,
  PullAccess,
  PushAccess,
  RunnerPoolChangeDetail,
  RunnerPoolId,
  RunnerLabels,
  RunnerTrustId,
  SealedProvisionSecret,
  TrustKey,
  TrustedWorkload,
  WorkspaceRunnersId,
  EgressDefined,
  EgressRedefined,
  EgressRetired,
  RunnerHostStartedServing,
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
