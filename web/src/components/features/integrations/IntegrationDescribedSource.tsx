import type { ConfiguredDescriptionResponseDto } from '@/lib/api';
import { since } from '@/lib/since';

const DESCRIPTIONS: Readonly<
  Record<ConfiguredDescriptionResponseDto['kind'], string>
> = {
  openapi: 'OpenAPI description',
  graphql: 'GraphQL schema',
  mcp: 'MCP server',
};

type IntegrationDescribedSourceProps = {
  described: ConfiguredDescriptionResponseDto;
};

export function IntegrationDescribedSource({
  described,
}: IntegrationDescribedSourceProps) {
  const what = DESCRIPTIONS[described.kind];

  if (described.problem) {
    return (
      <p className="text-destructive text-xs leading-5">
        Its {what} {described.problem}.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-xs leading-5">
      {described.tools === 1 ? '1 tool' : `${described.tools} tools`} from its{' '}
      {what}, read {since(described.readAt)}.
    </p>
  );
}
