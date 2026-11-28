import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { CONFIGURATION_STEP } from '@work/application/rendering/setup-steps';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';
import type { RepositoriesMissing } from '@work/domain/value-objects/repositories-missing.vo';

const lineNamed = (name: LineName): string =>
  /\bline$/i.test(name.value) ? name.value : `${name.value} line`;

const sentence = (text: string): string => {
  const trimmed = text.trim();

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const noRepository = (refusal: RepositoriesMissing): string => {
  const missing = `The ${lineNamed(refusal.line)} has no repository yet.`;

  return refusal.source
    ? `${missing} Add a \`repository\` block to its \`spotlight_line\` in \`${refusal.source.path}\` in ${refusal.source.repository.value}.`
    : `${missing} Add one in your team’s Terraform, as a \`repository\` block on the line’s \`spotlight_line\`. If the team has no configuration as code yet, start with “${CONFIGURATION_STEP}” on the setup checklist.`;
};

const CATALOG_FIXES: Readonly<Record<DeniedCatalogItem['reason'], string>> = {
  unknown:
    'Remove it from the station, or name a version that the catalog has.',
  'wrong-kind': 'Move it to the station’s list for that kind.',
};

export const RunRefused = {
  text(refusal: RefusalReason): string {
    switch (refusal.code) {
      case 'line_has_no_repositories':
        return noRepository(refusal);
      case 'catalog_item_unknown':
      case 'catalog_item_wrong_kind':
        return `${sentence(refusal.because)} ${CATALOG_FIXES[refusal.reason]}`;
      case 'harness_profile_unknown':
        return `The station uses harness profile ${refusal.profile.value}, which this team does not have. Add a \`spotlight_harness_profile\` with that key to the team’s Terraform, or change the station’s \`profile\`.`;
      case 'secret_awaiting_value':
        return `Secret ${refusal.secret.value} has no value yet. Set it on the Secrets settings page, with \`spotlight secret set ${refusal.secret.value}\`, or with \`value_wo\` and \`value_wo_version\` in Terraform.`;
      case 'secret_sandbox_not_allowed':
        return `Secret ${refusal.secret.value} does not allow its value in a sandbox. Set \`sandbox = "env"\` on the secret.`;
    }
  },
};
