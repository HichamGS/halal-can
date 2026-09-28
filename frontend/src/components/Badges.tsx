/**
 * Small shared presentational helpers. Badges render labels from the API's
 * verification/status values — no business data lives here.
 */

import { BadgeCheck, Clock, HelpCircle, ShieldAlert, ShieldX } from "lucide-react";
import type { PlaceStatus, VerificationStatus } from "../types";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  switch (status) {
    case "verified":
      return (
        <span className="mc-badge verified" title="Verified by our team">
          <BadgeCheck size={13} /> Verified
        </span>
      );
    case "pending":
      return (
        <span className="mc-badge pending" title="Verification in progress">
          <Clock size={13} /> Pending
        </span>
      );
    case "reported":
      return (
        <span className="mc-badge reported" title="Community reports under review">
          <ShieldAlert size={13} /> Reported
        </span>
      );
    case "rejected":
      return (
        <span className="mc-badge closed" title="Rejected during moderation">
          <ShieldX size={13} /> Rejected
        </span>
      );
    default:
      return (
        <span className="mc-badge" title="Not yet verified">
          <HelpCircle size={13} /> Unverified
        </span>
      );
  }
}

export function StatusBadge({ status }: { status: PlaceStatus }) {
  if (status === "temporarily_closed") {
    return <span className="mc-badge pending">Temporarily closed</span>;
  }
  if (status === "closed") {
    return <span className="mc-badge closed">Closed permanently</span>;
  }
  if (status === "pending") {
    return <span className="mc-badge pending">Pending activation</span>;
  }
  return null; // active — no badge needed
}
