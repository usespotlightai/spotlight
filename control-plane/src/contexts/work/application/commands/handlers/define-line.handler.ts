import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { DefineLineCommand } from '@work/application/commands/define-line.command';
import type { DefinedLineDto } from '@work/application/dto/line-resource.dto';
import type { LineCompilerPort } from '@work/application/ports/line-compiler.port';
import type { ApplyLines } from '@work/application/services/apply-lines.service';

export class DefineLineHandler
  implements CommandHandlerPort<DefineLineCommand, DefinedLineDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: LineCompilerPort,
    private readonly applying: ApplyLines,
  ) {}

  async execute(command: DefineLineCommand): Promise<DefinedLineDto | null> {
    try {
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.requesterId),
      );

      if (!membership?.administers) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { ok: false, problems: compiled.problems };
      }

      const { lines, problems } = await this.applying.apply(
        TeamId.of(command.teamId),
        [compiled.line],
      );
      const [line] = lines;

      if (problems.length > 0 || !line?.definition) {
        return { ok: false, problems };
      }

      return {
        ok: true,
        line: { id: line.id.value, definition: line.definition.fields },
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
