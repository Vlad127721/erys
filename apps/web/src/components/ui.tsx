import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'default' | 'primary' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-hairline bg-surface text-ink enabled:hover:border-ink-muted',
  primary: 'border-accent bg-accent text-accent-ink enabled:hover:brightness-110',
  ghost: 'border-transparent bg-transparent text-ink',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'default', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`cursor-pointer rounded-lg border px-3.5 py-[7px] font-medium disabled:cursor-default disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** An error inside a card or next to a control; the rest of the page keeps working. */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-0 mb-2 rounded-md bg-danger-wash px-2.5 py-1.5 text-[13px] text-danger" role="alert">
      {children}
    </p>
  );
}

const SPINNER_SIZES = { sm: 'size-3.5', md: 'size-6' } as const satisfies Record<string, string>;

export function Spinner({ size = 'md' }: { size?: keyof typeof SPINNER_SIZES }) {
  return (
    <span
      className={`block animate-spin rounded-full border-2 border-hairline border-t-accent motion-reduce:[animation-duration:3s] ${SPINNER_SIZES[size]}`}
      aria-hidden="true"
    />
  );
}
