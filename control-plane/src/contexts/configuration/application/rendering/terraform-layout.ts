import type { ExportableResourceDto } from '@configuration/application/dto/exportable-configuration.dto';

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

export const TERRAFORM_FILE = 'terraform.tf';

export const IMPORTS_FILE = 'imports.tf';

export const VARIABLES_FILE = 'variables.tf';

export const terraformFileOf = (resource: ExportableResourceDto): string => {
  switch (resource.kind) {
    case 'workspace':
    case 'oidc-trust':
      return 'workspace.tf';
    case 'secret':
      return 'secrets.tf';
    case 'runner-trust':
    case 'egress':
    case 'runner-pool':
    case 'workspace-runners':
      return 'runners.tf';
    case 'team':
      return `team-${resource.key}.tf`;
    case 'line':
      return `line-${resource.teamKey}-${resource.key}.tf`;
    case 'integration':
      return `integration-${resource.teamKey}-${resource.integration}.tf`;
    case 'skill':
      return `skills-${resource.teamKey}.tf`;
    case 'hook':
      return `hooks-${resource.teamKey}.tf`;
    case 'harness-profile':
      return `profiles-${resource.teamKey}.tf`;
  }
};
