import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
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

interface IntegrationTaskViewWaiting {
  readonly conversationId: string;
  readonly body: string;
  readonly awaitsApproval: boolean;
}

export interface IntegrationTaskView {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly waiting: IntegrationTaskViewWaiting | null;
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
  readonly owner: ConnectionOwner;
  readonly linkedAccount: string | null;
  unauthorized(token: AccessToken): Promise<AccessToken | null>;
}

export interface CallAuth {
  workspace(): Promise<string>;
  readonly connection: ActiveConnection | null;
  readonly credentials: Credentials;
}

export interface ServiceError {
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

export type PollResult =
  | {
      readonly kind: 'read';
      readonly cursor: string | null;
      readonly happenings: readonly Happened[];
    }
  | { readonly kind: 'failed'; readonly error: ServiceError };

export type ActionResult =
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly error: ServiceError }
  | { readonly kind: 'nothing-to-do' };

export interface TaskPayload {
  readonly task: IntegrationTaskView;
  readonly ask: {
    readonly body: string;
    readonly link: string | null;
    readonly station: string;
  };
}

export type PostResult =
  | { readonly kind: 'posted'; readonly marks: readonly TaskMark[] }
  | { readonly kind: 'unaddressed' }
  | {
      readonly kind: 'failed';
      readonly error: ServiceError;
      readonly target: Readonly<Record<string, string>>;
    };

export type RefreshResult =
  | { readonly kind: 'refreshed'; readonly tokens: OAuthTokens }
  | { readonly kind: 'failed' }
  | { readonly kind: 'not-refreshable' };

export interface ResolvedTool {
  readonly integration: Integration;
  readonly provided: ProvidedTool;
  readonly declared: ToolDeclaration;
  readonly injectedSecrets: readonly string[];
  defaultFor(input: string): unknown;
  call(inputs: ToolInputValues, callAuth: CallAuth): Promise<ToolOutput>;
}

export interface IntegrationRuntimePort {
  integrations(
    definitions: readonly DefinedIntegration[],
  ): readonly Integration[];

  poll(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    cursor: string | null,
    callAuth: CallAuth,
  ): Promise<PollResult>;

  runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    callAuth: CallAuth,
  ): Promise<ActionResult>;

  post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    payload: TaskPayload,
    callAuth: CallAuth,
  ): Promise<PostResult>;

  tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: IntegrationTaskView,
  ): Promise<ResolvedTool | null>;

  refresh(
    definitions: readonly DefinedIntegration[],
    teamId: TeamId,
    integration: IntegrationKey,
    refreshToken: AccessToken,
  ): Promise<RefreshResult>;
}
