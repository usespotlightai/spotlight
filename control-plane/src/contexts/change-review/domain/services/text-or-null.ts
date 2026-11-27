import { nonEmpty } from '@shared-kernel/domain/non-empty';
export const textOrNull = (text: string | null | undefined): string | null =>
  !nonEmpty(text) ? null : text;
