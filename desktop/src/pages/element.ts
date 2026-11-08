export const element = <T extends HTMLElement>(
  id: string,
  type: new () => T,
): T => {
  const found = document.getElementById(id);

  if (!(found instanceof type)) {
    throw new Error(`The page has no ${id} element.`);
  }

  return found;
};
