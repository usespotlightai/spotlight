import type { ApiSpecViewResponseDto } from '@/lib/api';
import { since } from '@/lib/since';

const SPEC_KINDS: Readonly<Record<ApiSpecViewResponseDto['kind'], string>> = {
  openapi: 'OpenAPI spec',
  graphql: 'GraphQL schema',
  mcp: 'MCP server',
};

export const toolsCounted = (tools: number): string =>
  tools === 1 ? '1 tool' : `${tools} tools`;

export const formatReadProblem = ({
  kind,
  problem,
}: ApiSpecViewResponseDto): string | null =>
  problem ? `Its ${SPEC_KINDS[kind]} ${problem}.` : null;

export const formatToolsRead = ({
  kind,
  tools,
  readAt,
}: ApiSpecViewResponseDto): string =>
  `${toolsCounted(tools)} from its ${SPEC_KINDS[kind]}, read ${since(readAt)}`;
