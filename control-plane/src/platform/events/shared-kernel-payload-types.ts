import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { JudgeScale } from '@shared-kernel/domain/value-objects/judge-scale.vo';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SHARED_KERNEL_PAYLOAD_TYPES = [
  RubricScale,
  Actor,
  ChangeActor,
  Client,
  ConfigurationChange,
  ConfigurationProblem,
  FieldPath,
  HarnessId,
  HarnessModel,
  HostAllowList,
  IdempotencyKey,
  InputSchema,
  LatencyHistogram,
  LineId,
  ModelUsage,
  PendingJob,
  PersonPrincipal,
  PullRequestUrl,
  Release,
  Repository,
  RunId,
  RunnerId,
  RunnerImage,
  RunnerPlacement,
  RunnerOffer,
  RunningImage,
  SecretName,
  StationId,
  TaskId,
  TeamAddress,
  TeamId,
  TokenHash,
  TokenPrincipal,
  UserId,
  WorkspaceId,
  ProvisionFailure,
  Provisioning,
  PoolId,
  RunnerReservation,
  Retry,
  CausalChain,
  Effort,
  Happening,
  LineKey,
  LineName,
  LineRole,
  ProfileKey,
  SkillKey,
  StationKey,
  StationName,
  Tool,
  JudgeCriteria,
  JudgeScale,
  JudgingFailure,
] as const;
