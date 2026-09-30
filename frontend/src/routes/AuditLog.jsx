// Audit Log page (/AuditLog): searchable, server-paged views over
// /api/audit/events/ (appointment activity) and /api/audit/notifications/
// (emails and texts sent), each with a CSV export of the current filters.
// Admin/Dispatch only; Dock users are redirected to the calendar.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import {
  authenticatedAtom,
  authCheckedAtom,
  userGroupsAtom,
  warehouseDataEffectAtom,
} from "../components/atoms.jsx";
import {
  ACTION_LABELS,
  CHANNEL_LABELS,
  NOTIFICATION_KIND_LABELS,
  STATUS_LABELS,
  actionLabel,
  channelLabel,
  fieldLabel,
  formatChangeValue,
  formatDateTime,
  isAuditViewer,
  kindLabel,
  statusLabel,
} from "../utils/auditLabels.js";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_ROWS_PER_PAGE = 50;
// Sentinel the events API accepts for "no actor" (public request form / unknown)
const NO_ACTOR = "none";

/** Drop empty filter values and join multi-selects the way the API expects. */
function buildParams(filters) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) params[key] = value.join(",");
    } else if (value !== "" && value !== null && value !== undefined) {
      params[key] = value;
    }
  });
  return params;
}

function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : fallback;
}

async function downloadCsv(url, params, fallbackName) {
  const response = await axios.get(url, {
    params: { ...params, export: "csv" },
    responseType: "blob",
  });
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "text/csv" });
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filenameFromDisposition(
    response.headers?.["content-disposition"],
    fallbackName
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

// --- Filter controls --------------------------------------------------------

function SingleSelect({ id, label, value, onChange, options, allLabel = "All" }) {
  return (
    <FormControl size="small" sx={{ minWidth: 170 }}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">{allLabel}</MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function MultiSelect({ id, label, value, onChange, options }) {
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <FormControl size="small" sx={{ minWidth: 200, maxWidth: 360 }}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        multiple
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(typeof v === "string" ? v.split(",") : v);
        }}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selected.map((v) => (
              <Chip key={v} label={labels[v] || v} size="small" />
            ))}
          </Box>
        )}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DateRange({ start, end, onStart, onEnd }) {
  return (
    <>
      <TextField
        size="small"
        type="date"
        label="From"
        value={start}
        onChange={(e) => onStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: end || undefined }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={end}
        onChange={(e) => onEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: start || undefined }}
      />
    </>
  );
}

// --- Shared paged table -----------------------------------------------------

function AuditTable({ testId, columns, result, rows, count, page, rowsPerPage, onPage, onRowsPerPage, emptyText }) {
  const colSpan = columns.length;
  return (
    <Paper sx={{ width: "100%", mb: 2 }}>
      <TableContainer>
        <Table size="small" data-testid={testId} sx={{ minWidth: 750 }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {result.isLoading && (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Loading...
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {result.isError && (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                  <Typography color="error">
                    Error loading audit log: {result.error?.response?.data?.detail || result.error?.message}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {result.isSuccess && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">{emptyText}</Typography>
                </TableCell>
              </TableRow>
            )}
            {result.isSuccess &&
              rows.map((row) => (
                <TableRow key={row.id} hover data-testid="audit-row">
                  {columns.map((col) => (
                    <TableCell key={col.id} sx={{ verticalAlign: "top" }}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        component="div"
        count={count}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_e, newPage) => onPage(newPage)}
        onRowsPerPageChange={(e) => onRowsPerPage(parseInt(e.target.value, 10))}
      />
    </Paper>
  );
}

/** Paging + query + export wiring shared by both tabs. */
function usePagedAudit(queryKey, url, filterParams) {
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  // The page is remembered together with the filters it was chosen under, so
  // any filter change goes straight back to the first page (without first
  // requesting the old page number under the new filters).
  const filterKey = JSON.stringify(filterParams);
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (p) => setPageState({ key: filterKey, page: p });

  const result = useQuery({
    queryKey: [queryKey, filterParams, page, rowsPerPage],
    queryFn: async () => {
      const response = await axios.get(url, {
        params: { ...filterParams, page: page + 1, page_size: rowsPerPage },
      });
      return response.data;
    },
    keepPreviousData: true,
    retry: 1,
    retryDelay: 1000,
  });

  const rows = result.data?.results ?? [];
  const count = result.data?.count ?? 0;

  return {
    result,
    rows,
    count,
    page,
    rowsPerPage,
    setPage,
    setRowsPerPage: (n) => {
      setRowsPerPage(n);
      setPage(0);
    },
  };
}

function ExportButton({ url, params, filename }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCsv(url, params, filename);
    } catch (e) {
      setError(e?.message || "Export failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Button
        variant="contained"
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        onClick={onClick}
        disabled={busy}
      >
        Export CSV
      </Button>
      {error && (
        <Typography variant="body2" color="error" role="alert">
          Export failed: {error}
        </Typography>
      )}
    </Box>
  );
}

function appointmentCell(row) {
  if (!row.appointment_ref && !row.appointment_company) return "—";
  const refs = (row.appointment_ref || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  return (
    <Box>
      <Typography variant="body2">{refs || "—"}</Typography>
      {row.appointment_company && (
        <Typography variant="caption" color="text.secondary">
          {row.appointment_company}
        </Typography>
      )}
    </Box>
  );
}

function ChangesCell({ row }) {
  const changes = row.changes && typeof row.changes === "object" ? row.changes : {};
  const fields = Object.keys(changes);
  if (fields.length === 0) return "";
  return (
    <Box component="ul" sx={{ m: 0, pl: 2 }}>
      {fields.map((field) => {
        const pair = Array.isArray(changes[field]) ? changes[field] : [null, changes[field]];
        return (
          <Typography component="li" variant="body2" key={field}>
            {fieldLabel(field)}: {formatChangeValue(field, pair[0])} → {formatChangeValue(field, pair[1])}
          </Typography>
        );
      })}
    </Box>
  );
}

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

// --- Tabs -------------------------------------------------------------------

function EventsTab({ warehouseOptions }) {
  const [actor, setActor] = useState("");
  const [actions, setActions] = useState([]);
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const actorsResult = useQuery({
    queryKey: ["auditActors"],
    queryFn: async () => (await axios.get("/api/audit/actors/")).data,
    staleTime: 5 * 60 * 1000,
  });
  const actorOptions = useMemo(
    () => [
      { value: NO_ACTOR, label: "Request form / unknown" },
      ...(actorsResult.data || []).map((a) => ({ value: String(a.id), label: a.name })),
    ],
    [actorsResult.data]
  );

  const filterParams = useMemo(
    () => buildParams({ actor, action: actions, warehouse, start, end }),
    [actor, actions, warehouse, start, end]
  );
  const paged = usePagedAudit("auditEvents", "/api/audit/events/", filterParams);

  const columns = [
    { id: "occurred_at", label: "When", render: (r) => formatDateTime(r.occurred_at) },
    { id: "action", label: "Action", render: (r) => actionLabel(r.action) },
    { id: "actor_name", label: "Person", render: (r) => r.actor_name },
    { id: "appointment", label: "Appointment", render: appointmentCell },
    { id: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name || "—" },
    { id: "changes", label: "Details", render: (r) => <ChangesCell row={r} /> },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
        <SingleSelect id="audit-actor" label="Person" value={actor} onChange={setActor} options={actorOptions} allLabel="Anyone" />
        <MultiSelect id="audit-action" label="Action" value={actions} onChange={setActions} options={toOptions(ACTION_LABELS)} />
        <SingleSelect id="audit-event-warehouse" label="Warehouse" value={warehouse} onChange={setWarehouse} options={warehouseOptions} />
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <Box sx={{ flexGrow: 1 }} />
        <ExportButton url="/api/audit/events/" params={filterParams} filename="appointment-activity.csv" />
      </Box>
      <AuditTable
        testId="audit-events-table"
        columns={columns}
        emptyText="No activity matches these filters."
        onPage={paged.setPage}
        onRowsPerPage={paged.setRowsPerPage}
        {...paged}
      />
    </Box>
  );
}

function NotificationsTab({ warehouseOptions }) {
  const [channel, setChannel] = useState("");
  const [kinds, setKinds] = useState([]);
  const [status, setStatus] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const recipient = useDebounced(recipientInput.trim());

  const filterParams = useMemo(
    () => buildParams({ channel, kind: kinds, status, warehouse, start, end, recipient }),
    [channel, kinds, status, warehouse, start, end, recipient]
  );
  const paged = usePagedAudit("auditNotifications", "/api/audit/notifications/", filterParams);

  const columns = [
    { id: "sent_at", label: "Sent", render: (r) => formatDateTime(r.sent_at) },
    { id: "channel", label: "Channel", render: (r) => channelLabel(r.channel) },
    { id: "kind", label: "Type", render: (r) => kindLabel(r.kind) },
    {
      id: "status",
      label: "Status",
      render: (r) => (
        <Chip
          size="small"
          label={statusLabel(r.status)}
          color={r.status === "failed" ? "error" : "success"}
          variant="outlined"
        />
      ),
    },
    { id: "recipient", label: "Recipient", render: (r) => r.recipient },
    {
      id: "subject",
      label: "Subject / error",
      render: (r) => (
        <Box>
          {r.subject && <Typography variant="body2">{r.subject}</Typography>}
          {r.error && (
            <Typography variant="body2" color="error">
              {r.error}
            </Typography>
          )}
        </Box>
      ),
    },
    { id: "appointment", label: "Appointment", render: appointmentCell },
    { id: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name || "—" },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
        <SingleSelect id="audit-channel" label="Channel" value={channel} onChange={setChannel} options={toOptions(CHANNEL_LABELS)} />
        <MultiSelect id="audit-kind" label="Type" value={kinds} onChange={setKinds} options={toOptions(NOTIFICATION_KIND_LABELS)} />
        <SingleSelect id="audit-status" label="Status" value={status} onChange={setStatus} options={toOptions(STATUS_LABELS)} />
        <SingleSelect id="audit-notification-warehouse" label="Warehouse" value={warehouse} onChange={setWarehouse} options={warehouseOptions} />
        <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <TextField
          size="small"
          label="Recipient"
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
        />
        <Box sx={{ flexGrow: 1 }} />
        <ExportButton url="/api/audit/notifications/" params={filterParams} filename="notifications.csv" />
      </Box>
      <AuditTable
        testId="audit-notifications-table"
        columns={columns}
        emptyText="No notifications match these filters."
        onPage={paged.setPage}
        onRowsPerPage={paged.setRowsPerPage}
        {...paged}
      />
    </Box>
  );
}

export default function AuditLog() {
  const navigate = useNavigate();
  const [authenticated] = useAtom(authenticatedAtom);
  const [authChecked] = useAtom(authCheckedAtom);
  const [userGroups] = useAtom(userGroupsAtom);
  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    refreshWarehouseData();
  }, []);

  // Same guard as PendingRequests: wait for the first auth check, then send
  // anonymous users to login and Dock users to the calendar.
  useEffect(() => {
    if (!authChecked) return;
    if (!authenticated) {
      navigate("/login");
    } else if (userGroups.includes("Dock") && !isAuditViewer(userGroups)) {
      navigate("/Calendar");
    }
  }, [authChecked, authenticated, userGroups]);

  const warehouseOptions = useMemo(
    () => (warehouseData || []).map((w) => ({ value: w.id, label: w.name })),
    [warehouseData]
  );

  if (!isAuditViewer(userGroups)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        {authChecked && authenticated && userGroups.length > 0 ? (
          <Alert severity="warning">You do not have access to the audit log.</Alert>
        ) : (
          <CircularProgress />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: 2 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Audit Log
      </Typography>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Appointment activity" id="audit-tab-events" aria-controls="audit-tabpanel-events" />
        <Tab label="Notifications" id="audit-tab-notifications" aria-controls="audit-tabpanel-notifications" />
      </Tabs>
      <Box role="tabpanel" id="audit-tabpanel-events" aria-labelledby="audit-tab-events" hidden={tab !== 0}>
        {tab === 0 && <EventsTab warehouseOptions={warehouseOptions} />}
      </Box>
      <Box
        role="tabpanel"
        id="audit-tabpanel-notifications"
        aria-labelledby="audit-tab-notifications"
        hidden={tab !== 1}
      >
        {tab === 1 && <NotificationsTab warehouseOptions={warehouseOptions} />}
      </Box>
    </Box>
  );
}
