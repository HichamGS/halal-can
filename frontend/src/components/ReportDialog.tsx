/**
 * ReportDialog — POST /api/v1/places/{id}/report
 * Reports enter the moderation queue; 3+ pending reports flip a place to
 * "reported" server-side so admins can review.
 */

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { reportPlace } from "../services/api";
import { ApiError } from "../services/http";
import type { ReportType } from "../types";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "closed", label: "Business is closed" },
  { value: "incorrect_info", label: "Information is incorrect" },
  { value: "address", label: "Address is wrong" },
  { value: "other", label: "Other issue" },
];

interface Props {
  placeId: number;
  placeName: string;
  onClose: () => void;
}

export default function ReportDialog({ placeId, placeName, onClose }: Props) {
  const [reportType, setReportType] = useState<ReportType>("incorrect_info");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Please describe the issue in at least a few words.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reportPlace(placeId, { report_type: reportType, message: message.trim() });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.details?.detail?.[0] ?? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>
          <Flag size={18} /> Report “{placeName}”
        </h2>

        {done ? (
          <>
            <p className="mc-alert success">
              Thanks! Your report was received and will be reviewed by a moderator.
            </p>
            <button className="mc-btn secondary" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mc-form-note" style={{ margin: "4px 0 12px" }}>
              Reports go through moderation — nothing changes on the listing until
              an admin verifies your report.
            </p>
            {error && <p className="mc-alert error">{error}</p>}

            <div className="mc-field">
              <label htmlFor="report-type">Issue</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mc-field">
              <label htmlFor="report-msg">Details</label>
              <textarea
                id="report-msg"
                rows={4}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. The phone number listed no longer works…"
              />
            </div>

            <button className="mc-btn danger" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Submit report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
