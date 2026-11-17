import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { useInferenceEndpointHealth } from '@/hooks/api/useInferenceEndpointHealth';
import { hostOf, type InferenceEndpoint } from '@/lib/inference';

type InferenceEndpointRowProps = {
  endpoint: InferenceEndpoint;
  workspaceId: string | undefined;
  checks: boolean;
};

export function InferenceEndpointRow({
  endpoint,
  workspaceId,
  checks,
}: InferenceEndpointRowProps) {
  const health = useInferenceEndpointHealth(workspaceId, endpoint, checks);

  return (
    <SettingsRow label={endpoint.model} description={hostOf(endpoint.baseUrl)}>
      {health.data?.ok === false && (
        <WarningTooltip
          data-slot="inference-endpoint-problem"
          tone="destructive"
          label="The endpoint check failed"
          tooltip={health.data.message}
        />
      )}
    </SettingsRow>
  );
}
