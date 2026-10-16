import { describeError } from "../_lib/api";
import { Icon } from "./Icon";

export function ErrorBanner({
  code,
  note,
  onDismiss,
}: {
  code: string;
  note?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="banner banner-error" role="alert">
      <Icon name="alert" />
      <div>
        <p className="banner-title">{describeError(code)}</p>
        <p className="banner-detail">
          <code>{code}</code>
          {note ? " · " + note : ""}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss error"
          onClick={onDismiss}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="banner banner-success" role="status">
      <Icon name="check" />
      <p className="banner-title">{message}</p>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss message"
        onClick={onDismiss}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
