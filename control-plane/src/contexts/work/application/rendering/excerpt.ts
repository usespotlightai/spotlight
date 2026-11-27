import { nonEmpty } from '@shared-kernel/domain/non-empty';
export const excerptOf = (
  text: string | null,
  length: number,
): string | null => {
  const trimmed = text?.trim();

  if (!nonEmpty(trimmed)) {
    return null;
  }

  const characters = Array.from(trimmed);

  return characters.length > length
    ? `${characters.slice(0, length).join('')}…`
    : trimmed;
};
