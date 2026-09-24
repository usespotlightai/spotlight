export const blockOf = (hcl: string, header: string): string => {
  const at = hcl.indexOf(`${header} {\n`);

  if (at < 0) {
    throw new Error(`no ${header} block`);
  }

  const rest = hcl.slice(at);

  return rest.slice(0, rest.indexOf('\n}\n') + '\n}'.length);
};
