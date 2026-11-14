export const excerptOf = (
  text: string | null,
  length: number,
): string | null => {
  const trimmed = text?.trim();

  if (!trimmed) {
    return null;
  }

  const characters = Array.from(trimmed);

  return characters.length > length
    ? `${characters.slice(0, length).join('')}…`
    : trimmed;
};
