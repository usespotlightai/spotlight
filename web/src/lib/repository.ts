export const nameUnder = (
  owner: string | null,
  fullName: string,
): string | null => {
  if (!owner) {
    return fullName;
  }

  const prefix = `${owner}/`;

  return fullName.startsWith(prefix) ? fullName.slice(prefix.length) : null;
};

export const fullNameOf = (owner: string | null, typed: string): string => {
  const name = typed.trim();

  return name && owner ? `${owner}/${name}` : name;
};
