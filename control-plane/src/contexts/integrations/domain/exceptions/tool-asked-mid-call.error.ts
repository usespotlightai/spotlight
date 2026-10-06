import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

export class ToolAskedMidCallError extends UpstreamRefusedError {
  constructor(tool: string) {
    super(
      `using ${tool}`,
      'the MCP server asked a question in the middle of the call, which Spotlight does not pass on to a person, so the call was refused',
      null,
      false,
    );
    this.name = 'ToolAskedMidCallError';
  }
}
