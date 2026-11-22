import type { SubmitAssistResultCommand } from '@assist/application/commands/submit-assist-result.command';
import type { AssistResultSubmitted } from '@assist/application/dto/assist-result.dto';
import type { AssistSessions } from '@assist/application/services/assist-sessions.service';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class SubmitAssistResultHandler implements CommandHandlerPort<
  SubmitAssistResultCommand,
  AssistResultSubmitted
> {
  constructor(private readonly sessions: AssistSessions) {}

  execute(command: SubmitAssistResultCommand): Promise<AssistResultSubmitted> {
    return this.sessions.submit(command);
  }
}
