import type { DescriptionViewResponseDto } from '@/lib/api';
import { since } from '@/lib/since';

const DESCRIPTIONS: Readonly<
  Record<DescriptionViewResponseDto['kind'], string>
> = {
  openapi: 'OpenAPI description',
  graphql: 'GraphQL schema',
  mcp: 'MCP server',
};

export const toolsCounted = (tools: number): string =>
  tools === 1 ? '1 tool' : `${tools} tools`;

export const formatReadProblem = ({
  kind,
  problem,
}: DescriptionViewResponseDto): string | null =>
  problem ? `Its ${DESCRIPTIONS[kind]} ${problem}.` : null;

export const formatToolsRead = ({
  kind,
  tools,
  readAt,
}: DescriptionViewResponseDto): string =>
  `${toolsCounted(tools)} from its ${DESCRIPTIONS[kind]}, read ${since(readAt)}`;
