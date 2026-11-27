import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { RunRefused } from '@work/application/rendering/run-refused';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import { LineSource } from '@work/domain/value-objects/line-source.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';
import { RepositoriesMissing } from '@work/domain/value-objects/repositories-missing.vo';
import { SecretAwaitingValue } from '@work/domain/value-objects/secret-awaiting-value.vo';
import { SecretSandboxNotAllowed } from '@work/domain/value-objects/secret-sandbox-not-allowed.vo';
import { describe, expect, it } from 'vitest';

const noRepository = (name: string, source: LineSource | null = null) =>
  RepositoriesMissing.of({ name: LineName.of(name), source });

describe('RunRefused', () => {
  it('says where to add a repository when the team’s configuration names the line’s file', () => {
    expect(
      RunRefused.text(
        noRepository(
          'Delivery',
          LineSource.of({
            repository: Repository.of('acme/infra'),
            path: 'teams/core/delivery.tf',
          }),
        ),
      ),
    ).toBe(
      'The Delivery line has no repository yet. Add a `repository` block to its `spotlight_line` in `teams/core/delivery.tf` in acme/infra.',
    );
  });

  it('points to the team’s Terraform, or to the setup checklist, when nothing names the line’s file', () => {
    expect(RunRefused.text(noRepository('Delivery'))).toBe(
      'The Delivery line has no repository yet. Add one in your team’s Terraform, as a `repository` block on the line’s `spotlight_line`. If the team has no configuration as code yet, start with “Set up configuration as code” on the setup checklist.',
    );
  });

  it('does not say “line” twice for a line whose name ends in it', () => {
    expect(RunRefused.text(noRepository('Support line'))).toMatch(
      /^The Support line has no repository yet\./,
    );
  });

  it.each([
    [
      DeniedCatalogItem.of({
        id: 'catalog.web-search@1.1.0',
        reason: 'unknown',
        because: 'Catalog has no item catalog.web-search@1.1.0.',
      }),
      'Catalog has no item catalog.web-search@1.1.0. Remove it from the station, or name a version that the catalog has.',
    ],
    [
      DeniedCatalogItem.of({
        id: 'catalog.web-search@^2',
        reason: 'unknown',
        because:
          'No version of catalog tool web-search matches ^2. Available versions: 1.1.0',
      }),
      'No version of catalog tool web-search matches ^2. Available versions: 1.1.0. Remove it from the station, or name a version that the catalog has.',
    ],
    [
      DeniedCatalogItem.of({
        id: 'catalog.research@1.0.0',
        reason: 'wrong-kind',
        because: 'Catalog item catalog.research@1.0.0 is a skill, not a tool.',
      }),
      'Catalog item catalog.research@1.0.0 is a skill, not a tool. Move it to the station’s list for that kind.',
    ],
    [
      ProfileMissing.of(ProfileKey.of('reckless')),
      'The station uses harness profile reckless, which this team does not have. Add a `spotlight_harness_profile` with that key to the team’s Terraform, or change the station’s `profile`.',
    ],
    [
      SecretAwaitingValue.of(SecretName.of('LINEAR_API_KEY')),
      'Secret LINEAR_API_KEY has no value yet. Set it on the Secrets settings page, with `spotlight secret set LINEAR_API_KEY`, or with `value_wo` and `value_wo_version` in Terraform.',
    ],
    [
      SecretSandboxNotAllowed.of(SecretName.of('DEV_GITHUB_APP_KEY')),
      'Secret DEV_GITHUB_APP_KEY does not allow its value in a sandbox. Set `sandbox = "env"` on the secret.',
    ],
  ] satisfies [RefusalReason, string][])(
    'words %o for a person',
    (refusal, text) => {
      expect(RunRefused.text(refusal)).toBe(text);
    },
  );

  it('keeps every refusal’s code, and the station, out of its words', () => {
    const refusals: RefusalReason[] = [
      noRepository('Delivery'),
      DeniedCatalogItem.of({ id: 'x', reason: 'wrong-kind', because: 'No.' }),
      ProfileMissing.of(ProfileKey.of('reckless')),
      SecretAwaitingValue.of(SecretName.of('A')),
      SecretSandboxNotAllowed.of(SecretName.of('A')),
    ];

    for (const each of refusals) {
      expect(RunRefused.text(each)).not.toContain(each.code);
      expect(RunRefused.text(each)).not.toContain('Station:');
    }
  });
});
