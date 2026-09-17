import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type {
  Happened,
  MarkWorn,
} from '@work/application/contracts/happenings.contract';
import type {
  ToolDeclaration,
  ToolInputDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const INTEGRATION_RUNTIME = Symbol('INTEGRATION_RUNTIME');

export interface Reach {
  readonly secret: Readonly<Record<string, string>>;
  readonly connection: AccessToken | null;
}

export interface HostRefusal {
  readonly status: number;
  readonly said: string;
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
  | { readonly kind: 'refused'; readonly refusal: HostRefusal };

export type Acted =
  | { readonly kind: 'done' }
  | { readonly kind: 'refused'; readonly refusal: HostRefusal }
  | { readonly kind: 'nothing-to-do' };

export interface TaskWord {
  readonly task: BoundTaskDto;
  readonly ask: {
    readonly body: string;
    readonly link: string | null;
    readonly station: string;
  };
}

export type Posted =
  | { readonly kind: 'posted'; readonly marks: readonly MarkWorn[] }
  | { readonly kind: 'unaddressed' }
  | {
      readonly kind: 'refused';
      readonly refusal: HostRefusal;
      readonly target: Readonly<Record<string, string>>;
    };

export type Renewed =
  | { readonly kind: 'renewed'; readonly grant: HostGrant }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unrenewable' };

export interface ReachableTool {
  readonly integration: Integration;
  readonly declared: ToolDeclaration;
  defaultFor(input: ToolInputDeclaration): unknown;
  call(inputs: ToolInputValues, reach: Reach): Promise<ToolOutput>;
}

export interface IntegrationRuntimePort {
  integrations(files: readonly ConfigurationFile[]): readonly Integration[];

  poll(
    files: readonly ConfigurationFile[],
    integration: Integration,
    cursor: string | null,
    reach: Reach,
  ): Promise<Polled>;

  runSchedule(
    files: readonly ConfigurationFile[],
    integration: Integration,
    reach: Reach,
  ): Promise<Acted>;

  post(
    files: readonly ConfigurationFile[],
    integration: Integration,
    event: string,
    word: TaskWord,
    reach: Reach,
  ): Promise<Posted>;

  tool(
    files: readonly ConfigurationFile[],
    tool: string,
    task: BoundTaskDto,
  ): ReachableTool | null;

  renew(
    files: readonly ConfigurationFile[],
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed>;
}
