import { EgressCreated } from '@runners/domain/events/egress-created.event';
import { EgressDeleted } from '@runners/domain/events/egress-deleted.event';
import { EgressUpdated } from '@runners/domain/events/egress-updated.event';
import { HostReady } from '@runners/domain/events/host-ready.event';
import { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import { RunnerPoolDeleted } from '@runners/domain/events/runner-pool-deleted.event';
import { RunnerPoolUpdated } from '@runners/domain/events/runner-pool-updated.event';
import { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import { RunnerTrustDeleted } from '@runners/domain/events/runner-trust-deleted.event';
import { RunnerTrustUpdated } from '@runners/domain/events/runner-trust-updated.event';
import { WorkspaceRunnersCreated } from '@runners/domain/events/workspace-runners-created.event';
import { WorkspaceRunnersDeleted } from '@runners/domain/events/workspace-runners-deleted.event';
import { WorkspaceRunnersUpdated } from '@runners/domain/events/workspace-runners-updated.event';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { EgressChangeDetail } from '@runners/domain/value-objects/egress-change-detail.vo';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressToken } from '@runners/domain/value-objects/egress-token.vo';
import { EgressTokenUsage } from '@runners/domain/value-objects/egress-token-usage.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
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
import { PoolToken } from '@runners/domain/value-objects/pool-token.vo';
import { PoolTokenUsage } from '@runners/domain/value-objects/pool-token-usage.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';

export const RUNNERS_PAYLOAD_TYPES = [
  CredentialSource,
  EgressChangeDetail,
  EgressId,
  EgressKey,
  EgressReference,
  EgressTraffic,
  EgressToken,
  EgressTokenUsage,
  EgressUrl,
  EncryptedProvisionSecret,
  HarnessVersion,
  HostId,
  HostImage,
  HostReport,
  BootId,
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
  SandboxDrainPolicy,
  SandboxId,
  SandboxKey,
  SandboxLease,
  TrustKey,
  TrustedWorkload,
  WorkspaceRunnersId,
  EgressCreated,
  EgressUpdated,
  EgressDeleted,
  HostReady,
  RunnerPoolCreated,
  RunnerPoolUpdated,
  RunnerPoolDeleted,
  RunnerTrustCreated,
  RunnerTrustUpdated,
  RunnerTrustDeleted,
  WorkspaceRunnersCreated,
  WorkspaceRunnersDeleted,
  WorkspaceRunnersUpdated,
] as const;
