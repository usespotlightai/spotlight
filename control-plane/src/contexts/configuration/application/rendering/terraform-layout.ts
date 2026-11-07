export const TERRAFORM_PROVIDER = 'spotlight';

export const terraformTypeOf = (kind: string): string =>
  `${TERRAFORM_PROVIDER}_${kind.replaceAll('-', '_')}`;

export const terraformNameOf = (...keys: readonly string[]): string => {
  const joined = keys.join('_');

  return /^[A-Za-z_]/.test(joined) ? joined : `_${joined}`;
};

export const terraformAttributeOf = (field: string): string =>
  field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const stationFileOf = (
  teamKey: string,
  lineKey: string,
  stationKey: string,
  field = 'prompt',
): string =>
  `prompts/${teamKey}/${lineKey}/${stationKey}${field === 'prompt' ? '' : `.${field}`}.md`;

export const judgeRubricFileOf = (
  teamKey: string,
  lineKey: string,
  stationKey: string,
): string => `judges/${teamKey}/${lineKey}/${stationKey}.md`;
