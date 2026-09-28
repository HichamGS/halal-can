/**
 * SuggestPlaceDialog — POST /api/v1/submissions/
 *
 * Dual purpose:
 *  1. "Suggest a place" (submission_type=suggest_place) from the header CTA.
 *  2. "Suggest an edit" on an existing place (report_incorrect /
 *     address_correction with place id + corrected values).
 *
 * Community & category pickers are populated from the API — new taxonomies
 * appear here automatically without code changes.
 */

import { useMemo, useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { createSubmission, fetchCategories, fetchCommunities } from "../services/api";
import { ApiError } from "../services/http";
import { useAsync } from "../hooks/useApi";
import type { SubmissionCreatePayload, SubmissionType } from "../types";

export type SuggestInitialValues = Partial<SubmissionCreatePayload>;

interface Props {
  onClose: () => void;
  /** When editing an existing place, pass its id + prefilled fields. */
  initialValues?: SuggestInitialValues;
  /** Default map centre for "use my location" prefill. */
  defaultLocation?: { lng: number; lat: number } | null;
}

const EDIT_TYPES: { value: SubmissionType; label: string }[] = [
  { value: "report_incorrect", label: "Some information is incorrect" },
  { value: "address_correction", label: "The address is wrong" },
];

export default function SuggestPlaceDialog({
  onClose,
  initialValues,
  defaultLocation,
}: Props) {
  const isEdit = !!initialValues?.place;
  const communities = useAsync((s) => fetchCommunities(s), []);
  const categories = useAsync((s) => fetchCategories(s), []);

  const [form, setForm] = useState<SuggestInitialValues>({
    submission_type: "suggest_place",
    suggested_latitude: defaultLocation?.lat,
    suggested_longitude: defaultLocation?.lng,
    ...initialValues,
  });
  const [selCategories, setSelCategories] = useState<string[]>(
    (initialValues?.categories as string[] | undefined) ?? []
  );
  const [selCommunities, setSelCommunities] = useState<string[]>(
    (initialValues?.communities as string[] | undefined) ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const patch = (p: Partial<SuggestInitialValues>) =>
    setForm((f) => ({ ...f, ...p }));

  const canSubmit = useMemo(() => {
    if (isEdit) return (form.message as string)?.trim().length >= 5;
    return !!(form.suggested_name?.trim() && form.suggested_city?.trim());
  }, [form, isEdit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors(null);
    setGlobalError(null);
    try {
      const payload: SubmissionCreatePayload = {
        ...(form as SubmissionCreatePayload),
        submission_type: (form.submission_type ?? "suggest_place") as SubmissionType,
        categories: selCategories.length ? selCategories : undefined,
        communities: selCommunities.length ? selCommunities : undefined,
      };
      await createSubmission(payload);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.details);
        setGlobalError(err.details ? null : err.message);
      } else {
        setGlobalError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldErr = (name: string) => errors?.[name]?.join(" ");

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Suggest an edit" : "Suggest a place"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>
          <PlusCircle size={18} />
          {isEdit ? "Suggest an edit" : "Suggest a place"}
        </h2>

        {done ? (
          <>
            <p className="mc-alert success">
              Thank you! Your {isEdit ? "correction" : "suggestion"} was received.
              A moderator will review it before it appears on the map.
            </p>
            <button className="mc-btn secondary" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="mc-form-note" style={{ margin: "4px 0 12px" }}>
              Submissions go through moderation and source verification — they are
              not published instantly.
            </p>
            {globalError && <p className="mc-alert error">{globalError}</p>}

            {isEdit && (
              <div className="mc-field">
                <label htmlFor="sub-type">What needs fixing?</label>
                <select
                  id="sub-type"
                  value={form.submission_type}
                  onChange={(e) => patch({ submission_type: e.target.value as SubmissionType })}
                >
                  {EDIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mc-field">
              <label htmlFor="s-name">Business / place name *</label>
              <input
                id="s-name"
                required={!isEdit}
                disabled={isEdit}
                value={form.suggested_name ?? ""}
                onChange={(e) => patch({ suggested_name: e.target.value })}
              />
              {fieldErr("suggested_name") && (
                <p className="error-text">{fieldErr("suggested_name")}</p>
              )}
            </div>

            {!isEdit && (
              <>
                <div className="mc-field">
                  <label htmlFor="s-address">Street address</label>
                  <input
                    id="s-address"
                    value={form.suggested_address ?? ""}
                    onChange={(e) => patch({ suggested_address: e.target.value })}
                  />
                </div>
                <div className="filter-grid">
                  <div className="mc-field">
                    <label htmlFor="s-city">City *</label>
                    <input
                      id="s-city"
                      required
                      value={form.suggested_city ?? ""}
                      onChange={(e) => patch({ suggested_city: e.target.value })}
                    />
                    {fieldErr("suggested_city") && (
                      <p className="error-text">{fieldErr("suggested_city")}</p>
                    )}
                  </div>
                  <div className="mc-field">
                    <label htmlFor="s-prov">Province / Territory</label>
                    <input
                      id="s-prov"
                      placeholder="e.g. ON"
                      maxLength={3}
                      value={form.suggested_province ?? ""}
                      onChange={(e) => patch({ suggested_province: e.target.value })}
                    />
                  </div>
                </div>
                <div className="filter-grid">
                  <div className="mc-field">
                    <label htmlFor="s-phone">Phone</label>
                    <input
                      id="s-phone"
                      type="tel"
                      value={form.suggested_phone ?? ""}
                      onChange={(e) => patch({ suggested_phone: e.target.value })}
                    />
                  </div>
                  <div className="mc-field">
                    <label htmlFor="s-web">Website</label>
                    <input
                      id="s-web"
                      type="url"
                      placeholder="https://…"
                      value={form.suggested_website ?? ""}
                      onChange={(e) => patch({ suggested_website: e.target.value })}
                    />
                  </div>
                </div>

                {(communities.data?.length ?? 0) > 0 && (
                  <div className="mc-field">
                    <label htmlFor="s-comm">Community (optional)</label>
                    <select
                      id="s-comm"
                      multiple
                      size={4}
                      value={selCommunities}
                      onChange={(e) =>
                        setSelCommunities(
                          Array.from(e.target.selectedOptions, (o) => o.value)
                        )
                      }
                    >
                      {communities.data?.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                    <p className="mc-form-note">Hold Ctrl/Cmd to select several.</p>
                  </div>
                )}

                {(categories.data?.length ?? 0) > 0 && (
                  <div className="mc-field">
                    <label htmlFor="s-cat">Category (optional)</label>
                    <select
                      id="s-cat"
                      multiple
                      size={4}
                      value={selCategories}
                      onChange={(e) =>
                        setSelCategories(
                          Array.from(e.target.selectedOptions, (o) => o.value)
                        )
                      }
                    >
                      {categories.data?.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="mc-field">
              <label htmlFor="s-msg">
                {isEdit ? "Describe the correction *" : "Anything else we should know?"}
              </label>
              <textarea
                id="s-msg"
                rows={3}
                required={isEdit}
                value={form.message ?? ""}
                onChange={(e) => patch({ message: e.target.value })}
              />
              {fieldErr("message") && <p className="error-text">{fieldErr("message")}</p>}
            </div>

            <div className="mc-field">
              <label htmlFor="s-email">Your email (optional — for follow-up)</label>
              <input
                id="s-email"
                type="email"
                value={form.submitter_email ?? ""}
                onChange={(e) => patch({ submitter_email: e.target.value })}
              />
              {fieldErr("submitter_email") && (
                <p className="error-text">{fieldErr("submitter_email")}</p>
              )}
            </div>

            <button className="mc-btn" type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Sending…" : isEdit ? "Send correction" : "Submit suggestion"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
