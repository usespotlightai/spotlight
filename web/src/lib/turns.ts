const SUMMARY_LENGTH = 240;

export const SKIPPED_OFF_SCREEN =
  '-mx-5 px-5 [content-visibility:auto] [contain-intrinsic-block-size:auto_160px]';

export const oneLineOf = (text: string): string =>
  text
    .replace(/[*`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SUMMARY_LENGTH);

export const stepsCounted = (count: number): string =>
  `${count} ${count === 1 ? 'step' : 'steps'}`;

export const keptOpen = (
  turns: readonly { readonly filled: boolean; readonly holds: boolean }[],
): boolean[] => {
  const last = turns.length - 1;
  const lastFilled = turns.findLastIndex((turn) => turn.filled);

  return turns.map(
    (turn, at) => turn.holds || at === last || at === lastFilled,
  );
};
