export const secretLabel = (name: string, integration: string): string => {
  const prefix = `${integration.toUpperCase()}_`;
  const words = (name.startsWith(prefix) ? name.slice(prefix.length) : name)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
};
