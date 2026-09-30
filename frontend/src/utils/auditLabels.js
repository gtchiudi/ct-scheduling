// Shared display helpers for the appointment audit trail (Activity history in
// the appointment window and the /AuditLog page). Kept free of component
// imports so both can use it without pulling in Form.jsx.
import dayjs from "dayjs";

export const DATETIME_FORMAT = "MM/DD/YYYY hh:mm A";

export const ACTION_LABELS = {
  created: "Created",
  approved: "Approved",
  declined: "Declined",
  edited: "Edited",
  checked_in: "Checked in",
  docked: "Docked",
  completed: "Completed",
  cancelled: "Cancelled",
  removed: "Removed from calendar",
};

export const NOTIFICATION_KIND_LABELS = {
  new_request: "New request",
  request_confirmation: "Request confirmation",
  calendar_event: "Calendar event",
  customer_scheduled: "Customer scheduled",
  approval: "Approval",
  decline: "Decline",
  cancellation: "Cancellation",
  dock_ready: "Dock ready",
  yard_drop: "Yard drop",
  sms_subscribed: "SMS subscribed",
};

export const CHANNEL_LABELS = { email: "Email", sms: "SMS" };
export const STATUS_LABELS = { sent: "Sent", failed: "Failed" };

// Friendly names for Request fields that can appear in an "edited" event's
// `changes`. Mirrors the labels used in Form.jsx.
export const FIELD_LABELS = {
  company_name: "Carrier name",
  customer_name: "Customer name",
  customer: "Customer",
  phone_number: "Phone number",
  email: "Email",
  warehouse: "Warehouse",
  ref_number: "Reference / PO number",
  load_type: "Load type",
  container_drop: "Container drop",
  container_number: "Container number",
  note_section: "Notes",
  date_time: "Appointment date and time",
  appointment_length: "Appointment window",
  delivery: "Pickup or delivery",
  load_config: "Palletized or floor loaded",
  trailer_number: "Trailer number",
  driver_phone_number: "Driver phone number",
  sms_consent: "SMS consent",
  dock_number: "Dock number",
  check_in_time: "Checked in",
  docked_time: "Docked time",
  completed_time: "Completed time",
  cancelled_time: "Cancelled at",
};

const DATETIME_FIELDS = new Set([
  "date_time",
  "check_in_time",
  "docked_time",
  "completed_time",
  "cancelled_time",
]);

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function humanize(key) {
  if (!key) return "";
  const s = String(key).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fieldLabel(field) {
  return FIELD_LABELS[field] || humanize(field);
}

export function actionLabel(action) {
  return ACTION_LABELS[action] || humanize(action);
}

export function kindLabel(kind) {
  return NOTIFICATION_KIND_LABELS[kind] || humanize(kind);
}

export function channelLabel(channel) {
  return CHANNEL_LABELS[channel] || humanize(channel);
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || humanize(status);
}

/** Format a timestamp for display; null/undefined -> "date unknown". */
export function formatDateTime(value) {
  if (value === null || value === undefined || value === "") return "date unknown";
  const d = dayjs(value);
  return d.isValid() ? d.format(DATETIME_FORMAT) : String(value);
}

function formatMinutes(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n)) return String(mins);
  if (n < 60) return `${n} Minutes`;
  const hours = n / 60;
  return `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
}

/** Render one side of an edit's before -> after for display. */
export function formatChangeValue(field, value) {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (field === "delivery") return value ? "Delivery" : "Pickup";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "appointment_length") return formatMinutes(value);
  if (field === "ref_number" && typeof value === "string") {
    return value.split(";").map((s) => s.trim()).filter(Boolean).join(", ");
  }
  if (DATETIME_FIELDS.has(field) || (typeof value === "string" && ISO_DATETIME_RE.test(value))) {
    return formatDateTime(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function isAuditViewer(userGroups) {
  return (userGroups || []).some((g) => ["Admin", "Dispatch"].includes(g));
}
