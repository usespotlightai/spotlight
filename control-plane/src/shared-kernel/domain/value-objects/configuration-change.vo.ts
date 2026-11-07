import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export type ResourceType = string;

export const CONFIGURATION_ACTIONS = ['created', 'updated', 'deleted'] as const;

export type ConfigurationAction = (typeof CONFIGURATION_ACTIONS)[number];

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
  readonly resource: ResourceType;
  readonly id: string;
  readonly key: string;
}

export class ConfigurationChange {
  private constructor(
    readonly resource: ResourceType,
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
    if (!isSlug(changed.resource)) {
      throw new InvalidIdentifierError(
        'resource type',
        'must be a lowercase slug',
      );
    }

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
