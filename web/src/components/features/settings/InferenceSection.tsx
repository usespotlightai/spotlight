import { InferenceEndpointRow } from '@/components/features/settings/InferenceEndpointRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DocsPillLink } from '@/components/shared/DocsPillLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { useInferenceEndpoint } from '@/hooks/api/useInferenceEndpoint';
import { INFERENCE_ENDPOINT_DOCS, INFERENCE_NOTE } from '@/lib/inference';
import { failed } from '@/lib/query';
import { INFERENCE_SECTION } from '@/lib/settings';

type InferenceSectionProps = {
  endpoint: ReturnType<typeof useInferenceEndpoint>;
  workspaceId: string | undefined;
  admin: boolean;
  pending: boolean;
};

export function InferenceSection({
  endpoint,
  workspaceId,
  admin,
  pending,
}: InferenceSectionProps) {
  const found = pending ? undefined : endpoint.data;

  return (
    <SettingsSection
      id={INFERENCE_SECTION}
      title="Inference"
      description={INFERENCE_NOTE}
      action={
        admin &&
        found && (
          <DocsPillLink page={INFERENCE_ENDPOINT_DOCS} size="small">
            Edit in Terraform
          </DocsPillLink>
        )
      }
    >
      {pending && (
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

      {!pending && failed(endpoint) && (
        <CouldNotLoad
          what="The inference endpoint"
          retrying={endpoint.isFetching}
          onRetry={() => void endpoint.refetch()}
          className="items-start px-4 py-3"
        />
      )}

      {found === null &&
        (admin ? (
          <div
            data-slot="inference-endpoint-empty"
            className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
          >
            <p className="text-muted-foreground text-sm">
              No inference endpoint
            </p>
            <DocsPillLink page={INFERENCE_ENDPOINT_DOCS}>
              Set up in Terraform
            </DocsPillLink>
          </div>
        ) : (
          <div
            data-slot="inference-endpoint-empty"
            className="flex min-h-12 flex-col justify-center gap-0.5 px-4 py-2"
          >
            <p className="text-muted-foreground text-sm">
              No inference endpoint
            </p>
            <p className="text-muted-foreground text-xs">
              An admin sets it up in Terraform
            </p>
          </div>
        ))}

      {found && (
        <InferenceEndpointRow
          endpoint={found}
          workspaceId={workspaceId}
          checks={admin}
        />
      )}
    </SettingsSection>
  );
}
