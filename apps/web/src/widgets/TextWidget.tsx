import { useId, useState } from 'react';
import { Button, InlineError } from '../components/ui';
import { useUpdateText } from './queries';

const ACTIONS = 'flex justify-end gap-2';

export function TextWidget({ id, text }: { id: string; text: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateText(id);
  const inputId = useId();

  if (draft === null) {
    return (
      <div className="flex flex-1 flex-col gap-3">
        <p className="m-0 flex-1 whitespace-pre-wrap text-ink wrap-anywhere">
          {text || <span className="text-ink-muted">Empty note</span>}
        </p>
        <div className={ACTIONS}>
          <Button onClick={() => setDraft(text)}>Edit</Button>
        </div>
      </div>
    );
  }

  const save = () => update.mutate(draft, { onSuccess: () => setDraft(null) });
  const cancel = () => {
    update.reset();
    setDraft(null);
  };

  return (
    <form
      className="flex flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Text
      </label>
      <textarea
        id={inputId}
        className="min-h-[180px] flex-1 resize-y rounded-lg border border-hairline bg-page px-3 py-2.5 text-ink"
        value={draft}
        maxLength={10_000}
        onChange={(event) => setDraft(event.target.value)}
        disabled={update.isPending}
        autoFocus
      />
      {update.isError && <InlineError>Could not save: {update.error.message}</InlineError>}
      <div className={ACTIONS}>
        <Button variant="ghost" onClick={cancel} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
