import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import type { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import type { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  Happened,
  TaskMark,
} from '@work/application/contracts/happenings.contract';
import type {
  ToolDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';

interface BoundTaskWaiting {
  readonly conversationId: string;
  readonly body: string;
  readonly awaitsApproval: boolean;
}

export interface BoundTask {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly waiting: BoundTaskWaiting | null;
}

export const INTEGRATION_RUNTIME = Symbol('INTEGRATION_RUNTIME');

export interface Credentials {
  injectedFor(
    url: string,
    secrets: readonly string[],
  ): Promise<InjectedSecrets>;
}

export interface SigningSecrets {
  named(secret: string): Promise<VerifyingSecret>;
}

export interface ActiveConnection {
  readonly token: AccessToken;
  readonly holder: ConnectionHolder;
  readonly handle: string | null;
  unauthorized(token: AccessToken): Promise<AccessToken | null>;
}

export interface Reach {
  readonly connection: ActiveConnection | null;
  readonly credentials: Credentials;
}

export interface HostError {
  readonly status: number;
  readonly output: string;
}

export type ToolOutput =
  | null
  | boolean
  | number
  | string
  | readonly ToolOutput[]
  | { readonly [field: string]: ToolOutput };

export type Polled =
  | {
      readonly kind: 'read';
      readonly cursor: string | null;
      readonly happenings: readonly Happened[];
    }
  | { readonly kind: 'failed'; readonly error: HostError };

export type Acted =
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly error: HostError }
  | { readonly kind: 'nothing-to-do' };

export interface TaskPayload {
  readonly task: BoundTask;
  readonly ask: {
    readonly body: string;
    readonly link: string | null;
    readonly station: string;
  };
}

export type Posted =
  | { readonly kind: 'posted'; readonly marks: readonly TaskMark[] }
  | { readonly kind: 'unaddressed' }
  | {
      readonly kind: 'failed';
      readonly error: HostError;
      readonly target: Readonly<Record<string, string>>;
    };

export type Renewed =
  | { readonly kind: 'renewed'; readonly grant: HostGrant }
  | { readonly kind: 'failed' }
  | { readonly kind: 'unrenewable' };

export interface ReachableTool {
  readonly integration: Integration;
  readonly offered: OfferedTool;
  readonly declared: ToolDeclaration;
  readonly injectedSecrets: readonly string[];
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues, reach: Reach): Promise<ToolOutput>;
}

export interface IntegrationRuntimePort {
  integrations(
    definitions: readonly DefinedIntegration[],
  ): readonly Integration[];

  poll(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    cursor: string | null,
    reach: Reach,
  ): Promise<Polled>;

  runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    reach: Reach,
  ): Promise<Acted>;

  post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    payload: TaskPayload,
    reach: Reach,
  ): Promise<Posted>;

  tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: BoundTask,
  ): Promise<ReachableTool | null>;

  renew(
    definitions: readonly DefinedIntegration[],
    teamId: TeamId,
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed>;
}
