import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';

export type AvatarSetDto =
  | { readonly outcome: 'set'; readonly digest: string }
  | Forbidden;
