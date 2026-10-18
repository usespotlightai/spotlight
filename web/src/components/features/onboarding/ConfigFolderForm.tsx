import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SETUP_CONTROL } from '@/components/features/onboarding/setup-control';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { useRepositories } from '@/hooks/api/useRepositories';
import { teamSectionPath } from '@/lib/team';
import { useForwardTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

const FOLDER = 'spotlight';

const LABEL = 'text-muted-foreground text-xs';

type ConfigFolderFormProps = {
  slug: string;
  teamId: string;
};

export function ConfigFolderForm({ slug, teamId }: ConfigFolderFormProps) {
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const { data: repositories } = useRepositories(slug);
  const [repository, setRepository] = useState<string | null>(null);
  const [folder, setFolder] = useState(FOLDER);
  const [reading, setReading] = useState<string[]>([]);

  const open = () => {
    const chosen = folder.trim();

    if (!repository || !chosen || reading.length === 0) {
      return;
    }

    navigate(teamSectionPath(slug, teamId, 'agent'), {
      state: {
        prompt: `Set up our configuration as code in ${repository}, under ${chosen}/.`,
        setup: { repository, folder: chosen },
        repositories: reading,
        trail,
      },
    });
  };

  return (
    <form
      className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        open();
      }}
    >
      <span className={LABEL}>Configuration</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <ChoiceSelect
          label="Repository"
          choices={(repositories ?? []).map((each) => ({
            value: each.fullName,
            label: each.fullName,
          }))}
          value={repository}
          placeholder="Repository"
          onChange={setRepository}
          clearable={false}
        />
        <span aria-hidden className="text-muted-foreground text-xs">
          /
        </span>
        <FieldInput
          aria-label="Folder"
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          className="h-8 w-28 rounded-full border-border bg-card px-3 text-xs"
        />
      </div>

      <span className={LABEL}>Team code</span>
      <RepositoriesSelect
        slug={slug}
        value={reading}
        onChange={setReading}
        none="Repositories your team works in"
        className="h-8 w-fit rounded-full border border-border bg-card px-3 text-xs"
      />

      <Button
        type="submit"
        size="sm"
        disabled={!repository || !folder.trim() || reading.length === 0}
        className={cn(SETUP_CONTROL, 'col-span-2 mt-1 w-fit')}
      >
        Continue in chat
      </Button>
    </form>
  );
}
