import { Button, Spinner } from './ui';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

const STATUS = 'flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-6 text-center';

export function ErrorState({ title, message, onRetry, retrying }: ErrorStateProps) {
  return (
    <div className={`${STATUS} text-ink-secondary`} role="alert">
      <svg className="size-7 text-danger" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="m-0 font-semibold text-ink">{title}</p>
      <p className="mt-0 mb-1.5 max-w-[36ch] text-[13px] wrap-anywhere">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className={STATUS} role="status" aria-live="polite">
      <Spinner />
      <span className="sr-only">{label}</span>
    </div>
  );
}
