import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export const SHARED_KERNEL_PAYLOAD_TYPES = [
  RubricScale,
  Actor,
  Attribution,
  Client,
  ConfigurationChange,
  ConfigurationProblem,
  FieldPath,
  HarnessId,
  HarnessModel,
  IdempotencyKey,
  InputSchema,
  LatencyHistogram,
  ModelUsage,
  OwedWork,
  PersonPrincipal,
  PullRequestUrl,
  Repository,
  RunId,
  RunnerId,
  RunnerImage,
  RunnerPlacement,
  RunnerTerms,
  RunningImage,
  SecretName,
  TaskId,
  TeamAddress,
  TeamId,
  TokenHash,
  TokenPrincipal,
  TokenScope,
  TokenScopes,
  UserId,
  WorkspaceId,
  WorkspaceTokenId,
  WorkspaceTokenTrustId,
  ProvisionFailure,
  Provisioning,
  PoolId,
  RunnerReservation,
  Retry,
  CausalChain,
] as const;
