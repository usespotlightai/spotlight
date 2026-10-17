export const latestWithin = (
  lines: readonly string[],
  max: number,
): string[] => {
  const kept: string[] = [];
  let used = 0;

  for (const line of [...lines].reverse()) {
    if (used + line.length > max) {
      break;
    }

    kept.unshift(line);
    used += line.length + 1;
  }

  return kept;
};
