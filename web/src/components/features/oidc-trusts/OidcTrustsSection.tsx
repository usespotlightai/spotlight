import { NoOidcTrusts } from '@/components/features/oidc-trusts/NoOidcTrusts';
import { OidcTrustRow } from '@/components/features/oidc-trusts/OidcTrustRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { useOidcTrusts } from '@/hooks/api/useOidcTrusts';
import { failed, loading } from '@/lib/query';

type OidcTrustsSectionProps = {
  slug: string | undefined;
};

export function OidcTrustsSection({ slug }: OidcTrustsSectionProps) {
  const trusts = useOidcTrusts(slug);

  return (
    <SettingsSection title="OIDC trusts" count={trusts.data?.length}>
      {loading(trusts) && (
        <div role="status" aria-label="Loading the OIDC trusts">
          <IconRowSkeleton
            nameWidth="w-24"
            aboutWidth="w-72"
            trailingWidth="w-20"
          />
        </div>
      )}

      {failed(trusts) && (
        <CouldNotLoad
          what="OIDC trusts"
          retrying={trusts.isFetching}
          onRetry={() => void trusts.refetch()}
          className="px-4 py-6 text-center"
        />
      )}

      {trusts.data?.length === 0 && <NoOidcTrusts />}

      {trusts.data?.map((trust) => (
        <OidcTrustRow key={trust.id} trust={trust} />
      ))}
    </SettingsSection>
  );
}
