export const namesOf = (
  people: readonly { readonly name: string }[],
): string => {
  const names = people.map((each) => each.name.trim() || 'Someone');

  if (names.length <= 1) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};
