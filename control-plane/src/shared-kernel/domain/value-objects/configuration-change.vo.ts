import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export const CONFIGURED_RESOURCES = [
  'workspace',
  'team',
  'line',
  'skill',
  'harness-profile',
  'integration',
  'hook',
  'secret',
  'workspace-token',
  'oidc-trust',
  'runner-trust',
  'runner-pool',
  'egress',
  'workspace-runners',
  'replay-candidate',
  'replay',
  'replay-search',
  'replay-check',
  'config-pull-request',
  'terraform-state',
] as const;

export type ConfiguredResource = (typeof CONFIGURED_RESOURCES)[number];

export type ConfigurationAction = 'created' | 'updated' | 'deleted';

type RecordedValue =
  | null
  | boolean
  | number
  | string
  | readonly RecordedValue[];

export type RecordedDetail = Readonly<Record<string, RecordedValue>>;

export interface ChangeDetail {
  recorded(): RecordedDetail;
}

interface Changed {
  readonly resource: ConfiguredResource;
  readonly id: string;
  readonly key: string;
}

export class ConfigurationChange {
  private constructor(
    readonly resource: ConfiguredResource,
    readonly resourceId: string,
    readonly key: string,
    readonly action: ConfigurationAction,
    readonly by: ChangeActor,
    readonly detail: ChangeDetail | null,
  ) {}

  static created(
    changed: Changed,
    by: ChangeActor,
    detail: ChangeDetail | null = null,
  ): ConfigurationChange {
    return ConfigurationChange.of(changed, 'created', by, detail);
  }

  static updated(
    changed: Changed,
    by: ChangeActor,
    detail: ChangeDetail | null = null,
  ): ConfigurationChange {
    return ConfigurationChange.of(changed, 'updated', by, detail);
  }

  static deleted(changed: Changed, by: ChangeActor): ConfigurationChange {
    return ConfigurationChange.of(changed, 'deleted', by, null);
  }

  get recordedDetail(): RecordedDetail {
    return this.detail?.recorded() ?? {};
  }

  private static of(
    changed: Changed,
    action: ConfigurationAction,
    by: ChangeActor,
    detail: ChangeDetail | null,
  ): ConfigurationChange {
    return new ConfigurationChange(
      changed.resource,
      changed.id,
      changed.key,
      action,
      by,
      detail,
    );
  }
}
