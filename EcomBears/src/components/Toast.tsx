export type ToastState = { kind: 'ok' | 'error' | 'info'; text: string };

type Props = { toast: ToastState | null };

// Shows a short message. The page decides when it appears and clears it.
export default function Toast({ toast }: Props) {
  if (!toast) return null;
  return <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>;
}
