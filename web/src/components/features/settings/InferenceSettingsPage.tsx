import { InferenceEndpointRow } from '@/components/features/settings/InferenceEndpointRow';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DocsPillLink } from '@/components/shared/DocsPillLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useInferenceEndpoint } from '@/hooks/api/useInferenceEndpoint';
import { INFERENCE_ENDPOINT_DOCS } from '@/lib/inference';
import { failed, loading } from '@/lib/query';

type InferenceSettingsPageProps = {
  workspaceId: string | undefined;
  checks: boolean;
};

export function InferenceSettingsPage({
  workspaceId,
  checks,
}: InferenceSettingsPageProps) {
  const endpoint = useInferenceEndpoint(workspaceId);
  const found = endpoint.data;

  return (
    <SettingsPage
      title="Inference"
      description="The OpenAI-compatible endpoint for change stacks, agent decisions, answer grading and judges. Set in Terraform."
    >
      <SettingsSection>
        {failed(endpoint) && (
          <CouldNotLoad
            what="The inference endpoint"
            retrying={endpoint.isFetching}
            onRetry={() => void endpoint.refetch()}
            className="items-start px-4 py-3"
          />
        )}

        {loading(endpoint) && (
          <div
            role="status"
            aria-label="Loading the inference endpoint"
            className="flex min-h-12 items-center px-4 py-2"
          >
            <span className="flex flex-col gap-0.5">
              <SkeletonLine className="w-32 text-sm" />
              <SkeletonLine className="w-20 text-xs" />
            </span>
          </div>
        )}

        {found === null && (
          <div
            data-slot="inference-endpoint-empty"
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
          >
            <p className="text-muted-foreground text-sm">
              No inference endpoint
            </p>
            <DocsPillLink page={INFERENCE_ENDPOINT_DOCS}>
              Set up in Terraform
            </DocsPillLink>
          </div>
        )}

        {found && (
          <InferenceEndpointRow
            endpoint={found}
            workspaceId={workspaceId}
            checks={checks}
          />
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
