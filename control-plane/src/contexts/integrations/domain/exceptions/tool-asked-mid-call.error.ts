import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

export class ToolAskedMidCallError extends UpstreamRefusedError {
  constructor(tool: string) {
    super(
      `using ${tool}`,
      'the MCP server asked a question in the middle of the call. Spotlight refused the call. It does not pass such questions on to a person',
      null,
      false,
    );
    this.name = 'ToolAskedMidCallError';
  }
}
