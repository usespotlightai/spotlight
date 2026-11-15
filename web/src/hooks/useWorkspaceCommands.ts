import { useNavigate } from 'react-router';

import { useLines } from '@/hooks/api/useLines';
import { useCommands } from '@/hooks/useCommands';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import type { Command } from '@/lib/commands/registry';
import type { PalettePick } from '@/lib/commands/targets';
import { inboxPath } from '@/lib/inbox';
import { workspaceGeneralPath } from '@/lib/settings';
import { creatingState } from '@/lib/task-create';
import {
  linePath,
  type Team,
  type TeamSectionId,
  teamSectionPath,
} from '@/lib/team';

type WorkspaceCommands = {
  slug: string;
  teams: readonly Team[];
  onPalette: (pick?: PalettePick) => void;
  onTogglePalette: () => void;
  onShortcuts: () => void;
};

const LINES: PalettePick = { section: 'Lines' };

const SECTION_KEYS = {
  agent: 'go.agent',
  runs: 'go.runs',
  insights: 'go.insights',
  memory: 'go.memory',
} as const satisfies Record<TeamSectionId, Command['id']>;

export function useWorkspaceCommands({
  slug,
  teams,
  onPalette,
  onTogglePalette,
  onShortcuts,
}: WorkspaceCommands) {
  const navigate = useNavigate();
  const team = useCurrentTeam(teams);
  const { data: lines = [] } = useLines(team?.id);
  const [firstLine] = lines;
  const go = (to: string) => ({ to, run: () => void navigate(to) });

  useCommands([
    { id: 'palette.open', run: onTogglePalette },
    { id: 'search', run: () => onPalette() },
    { id: 'shortcuts.show', run: onShortcuts },
    { id: 'go.inbox', ...go(inboxPath(slug)) },
    ...(team
      ? (Object.keys(SECTION_KEYS) as TeamSectionId[]).map((section) => ({
          id: SECTION_KEYS[section],
          ...go(teamSectionPath(slug, team.id, section)),
        }))
      : []),
    ...(team && lines.length === 1 && firstLine
      ? [
          {
            id: 'go.lines' as const,
            ...go(linePath(slug, team.id, firstLine.id)),
          },
        ]
      : [{ id: 'go.lines' as const, run: () => onPalette(LINES) }]),
    { id: 'go.settings', ...go(workspaceGeneralPath(slug)) },
    { id: 'open.line', run: () => onPalette(LINES) },
    { id: 'open.station', run: () => onPalette({ section: 'Stations' }) },
    { id: 'open.task', run: () => onPalette({ section: 'Tasks' }) },
    ...(team && firstLine
      ? [
          {
            id: 'task.create' as const,
            run: () =>
              lines.length === 1
                ? void navigate(linePath(slug, team.id, firstLine.id), {
                    state: creatingState(),
                  })
                : onPalette({ section: 'Lines', creating: true }),
          },
        ]
      : []),
  ]);
}
