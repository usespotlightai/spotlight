import { type KeyboardEvent, type SubmitEvent, useRef, useState } from 'react';

import { AttachButton } from '@/components/shared/attachment/AttachButton';
import { PendingAttachments } from '@/components/shared/attachment/PendingAttachments';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useAttachments } from '@/hooks/useAttachments';
import { messageOf } from '@/lib/error';
import type { NewTask } from '@/lib/task';

type NewTaskDialogProps = {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineName: string;
  stationName: string;
  onCreate: (task: NewTask) => Promise<unknown>;
};

export function NewTaskDialog({
  slug,
  open,
  onOpenChange,
  lineName,
  stationName,
  onCreate,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState('');
  const description = useRef('');
  const [more, setMore] = useState(false);
  const [round, setRound] = useState(0);
  const [creating, setCreating] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const draft = useAttachments(slug);

  const uncreatable = !title.trim() || draft.uploading || creating;

  const reset = () => {
    setTitle('');
    setRefusal(null);
    description.current = '';
    draft.clear();
    setRound((each) => each + 1);
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (uncreatable) {
      return;
    }

    setCreating(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.current.trim(),
        attachments: draft.ids,
      });
    } catch (thrown) {
      setCreating(false);
      setRefusal(messageOf(thrown));
      return;
    }
    setCreating(false);

    if (more) {
      reset();
    } else {
      onOpenChange(false);
    }
  };

  const submitOnModEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => !open && reset()}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground text-xs">
            <Breadcrumbs
              namesTab={false}
              segments={[
                { label: lineName },
                { label: stationName },
                { label: 'New task' },
              ]}
            />
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => void submit(event)}
          onKeyDownCapture={submitOnModEnter}
          {...draft.handlers}
          className="contents"
        >
          <ScrollArea
            className="max-h-[60vh]"
            contentClassName="flex flex-col gap-3"
          >
            <AutoGrowTextarea
              autoFocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setRefusal(null);
              }}
              placeholder="Task title"
              aria-label="Task title"
              className="font-medium text-base text-foreground leading-6"
            />

            {refusal && (
              <p role="alert" className="text-destructive text-xs">
                {refusal}
              </p>
            )}

            <MarkdownEditor
              key={round}
              initialValue=""
              onChange={(written) => {
                description.current = written;
              }}
              placeholder="Add description…"
              ariaLabel="Task description"
              className="min-h-24 border-none bg-transparent p-0"
              placeholderClassName="top-0 left-0"
            />

            <PendingAttachments
              attachments={draft.attachments}
              onRemove={draft.remove}
            />
          </ScrollArea>

          <DialogFooter className="items-center sm:justify-between">
            <AttachButton
              onAttach={draft.add}
              className="rounded-full border-border text-muted-foreground"
            />

            <div className="flex items-center gap-3">
              <label
                htmlFor="create-more"
                className="flex select-none items-center gap-2 text-muted-foreground text-xs"
              >
                <Switch
                  id="create-more"
                  checked={more}
                  onCheckedChange={setMore}
                />
                Create more
              </label>

              <Button type="submit" size="sm" disabled={uncreatable}>
                Create task
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
