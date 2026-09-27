export const latestWithin = (
  lines: readonly string[],
  most: number,
): string[] => {
  const kept: string[] = [];
  let used = 0;

  for (const line of [...lines].reverse()) {
    if (used + line.length > most) {
      break;
    }

    kept.unshift(line);
    used += line.length + 1;
  }

  return kept;
};
