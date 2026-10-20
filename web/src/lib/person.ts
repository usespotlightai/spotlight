export type Person = {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
};

export const YOU = { name: 'You', image: null } as const;

export function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return initials || '?';
}
