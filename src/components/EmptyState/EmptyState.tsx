import { SearchX } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No places found",
  message = "Try changing your filters or searching another city.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="state-panel" role="status">
      <span className="state-icon" aria-hidden="true">
        <SearchX size={32} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
