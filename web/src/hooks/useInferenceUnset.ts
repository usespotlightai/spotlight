import { useInferenceEndpoint } from '@/hooks/api/useInferenceEndpoint';
import { useWorkspace } from '@/hooks/api/useWorkspace';

export function useInferenceUnset(slug: string | undefined): boolean {
  const { data: workspace } = useWorkspace(slug);
  const endpoint = useInferenceEndpoint(workspace?.id);

  return endpoint.data === null;
}
