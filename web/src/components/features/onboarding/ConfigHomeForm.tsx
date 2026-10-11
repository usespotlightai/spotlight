import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SETUP_CONTROL } from '@/components/features/onboarding/setup-control';
import { AgentPicker } from '@/components/features/stations/AgentPicker';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRepositories } from '@/hooks/api/useRepositories';
import { useStartChat } from '@/hooks/api/useStartChat';
import { useRemembered } from '@/hooks/useRemembered';
import { CHAT_HARNESS_KEY, chatPath } from '@/lib/chat';
import { messageOf } from '@/lib/error';

const FOLDER = 'spotlight';

type ConfigHomeFormProps = {
  slug: string;
  teamId: string;
};

export function ConfigHomeForm({ slug, teamId }: ConfigHomeFormProps) {
  const navigate = useNavigate();
  const { data: repositories } = useRepositories(slug);
  const { data: harnesses } = useHarnesses();
  const [held, remember] = useRemembered(CHAT_HARNESS_KEY, '');
  const [repository, setRepository] = useState<string | null>(null);
  const [folder, setFolder] = useState(FOLDER);
  const [reading, setReading] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const start = useStartChat();

  const harness = harnesses?.some((each) => each.id === held)
    ? held
    : (harnesses?.[0]?.id ?? '');
  const ready = Boolean(repository && folder.trim() && harness);

  const begin = () => {
    if (!repository || !ready) {
      return;
    }

    start.mutate(
      {
        teamId,
        harness,
        model: model || null,
        effort: effort || null,
        repositories: reading,
        body: `Set up our configuration as code in ${repository}, under ${folder.trim()}/.`,
        attachments: [],
        traces: [],
        setup: { repository, folder: folder.trim() },
      },
      { onSuccess: (chat) => navigate(chatPath(slug, teamId, chat.id)) },
    );
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        begin();
      }}
    >
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

      <FieldInput
        aria-label="Folder"
        value={folder}
        onChange={(event) => setFolder(event.target.value)}
        className="h-8 w-32 rounded-full border-border bg-card px-3 text-xs"
      />

      <RepositoriesSelect
        slug={slug}
        value={reading}
        onChange={setReading}
        className="h-8 w-auto"
      />

      <AgentPicker
        harness={harness}
        model={model}
        effort={effort}
        onHarness={(next) => {
          remember(next);
          setModel('');
          setEffort('');
        }}
        onModel={setModel}
        onEffort={setEffort}
      />

      <Button
        type="submit"
        size="sm"
        disabled={!ready || start.isPending}
        className={SETUP_CONTROL}
      >
        Start setup chat
      </Button>

      {start.isError && (
        <p role="alert" className="w-full text-destructive text-sm leading-6">
          {messageOf(start.error, 'Sorry, the setup chat could not start.')}
        </p>
      )}
    </form>
  );
}
