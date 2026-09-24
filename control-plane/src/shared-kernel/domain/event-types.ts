import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { HarnessRelease } from '@shared-kernel/domain/value-objects/harness-release.vo';
import { HarnessVersion } from '@shared-kernel/domain/value-objects/harness-version.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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

export const SHARED_KERNEL_EVENT_TYPES = [
  Actor,
  Attribution,
  Client,
  ConfigurationChange,
  ConfigurationFile,
  ConfigurationProblem,
  DefinitionDocument,
  FieldPath,
  HarnessId,
  HarnessModel,
  HarnessRelease,
  HarnessVersion,
  IdempotencyKey,
  PersonPrincipal,
  PullRequestUrl,
  Repository,
  RunId,
  RunnerId,
  RunnerPlacement,
  RunnerTerms,
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
  ProvisionFailure,
  Provisioning,
  RunnerReservation,
] as const;
