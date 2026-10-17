import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

export class ToolAskedMidCallError extends UpstreamError {
  constructor(tool: string) {
    super(
      `using ${tool}`,
      'the MCP server asked a question in the middle of the call. Spotlight does not pass such questions on to a person, so the call failed',
      null,
      false,
    );
    this.name = 'ToolAskedMidCallError';
  }
}
