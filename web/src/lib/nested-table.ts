export type NestedHeading = {
  readonly label: string;
  readonly numeric?: boolean;
  readonly tooltip?: string;
  readonly indent?: 'edge' | 'outer' | 'inner';
  readonly size?: string;
};

export const SPREAD = 'minmax(max-content,1fr)';

const FILLER = 'minmax(0,1fr)';

const sizesOf = (
  headings: readonly NestedHeading[],
  widths: readonly (number | null)[],
  trailing: boolean,
): string[] =>
  [
    ...headings.map((heading) => heading.size ?? 'max-content'),
    ...(trailing ? ['max-content'] : []),
  ].map((size, at) => {
    const chosen = widths[at];
    return chosen ? `${chosen}px` : size;
  });

export const filled = (
  headings: readonly NestedHeading[],
  widths: readonly (number | null)[],
  trailing: boolean,
): boolean =>
  !sizesOf(headings, widths, trailing).some((size) => size.includes('fr'));

export const columnTemplate = (
  headings: readonly NestedHeading[],
  widths: readonly (number | null)[],
  trailing: boolean,
): string => {
  const sizes = sizesOf(headings, widths, trailing);

  return [
    ...sizes,
    ...(filled(headings, widths, trailing) ? [FILLER] : []),
  ].join(' ');
};
