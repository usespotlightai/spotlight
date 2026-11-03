export const trimmedWithin = (
  raw: string,
  longest: number,
  invalid: (because: string) => Error,
): string => {
  const trimmed = raw.trim();

  if (trimmed.length > longest) {
    throw invalid(`must be at most ${longest} characters`);
  }

  return trimmed;
};
