// Destructive-action confirmation modal.
import { useAxonConfirm } from "../AxonProvider";

export function ConfirmDialog() {
  const { pending, answer } = useAxonConfirm();
  if (!pending) return null;

  return (
    <div className="axon-confirm-overlay" role="dialog" aria-modal="true">
      <div className="axon-confirm">
        <div className="axon-confirm-title">AXON · Confirmation</div>
        <div className="axon-confirm-body">{pending.message}</div>
        <div className="axon-confirm-actions">
          <button className="axon-btn" onClick={() => answer(pending.id, false)}>
            Cancel
          </button>
          <button className="axon-btn" onClick={() => answer(pending.id, true)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
