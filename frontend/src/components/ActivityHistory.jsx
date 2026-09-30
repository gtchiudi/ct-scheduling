// Activity history for one appointment: actions (created, approved, edits,
// check-in...) and the emails/texts sent about it, merged into one timeline by
// GET /api/audit/timeline/?appointment=<id>. Rendered at the bottom of the
// appointment window (CustomViewer in Calendar.jsx) for Admin/Dispatch only.
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import axios from "axios";
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import { userGroupsAtom } from "./atoms.jsx";
import {
  actionLabel,
  channelLabel,
  fieldLabel,
  formatChangeValue,
  formatDateTime,
  isAuditViewer,
  kindLabel,
} from "../utils/auditLabels.js";

function EventDescription({ item }) {
  const changes = item.changes && typeof item.changes === "object" ? item.changes : {};
  const fields = Object.keys(changes);
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {actionLabel(item.action)}
      </Typography>
      {item.action === "edited" && fields.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {fields.map((field) => {
            const pair = Array.isArray(changes[field]) ? changes[field] : [null, changes[field]];
            return (
              <Typography
                component="li"
                variant="body2"
                key={field}
                data-testid="activity-change"
              >
                {fieldLabel(field)}: {formatChangeValue(field, pair[0])} →{" "}
                {formatChangeValue(field, pair[1])}
              </Typography>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function NotificationDescription({ item }) {
  const failed = item.status === "failed";
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {channelLabel(item.channel)} {failed ? "failed" : "sent"}: {kindLabel(item.kind)}
        {failed && (
          <Chip label="Failed" color="error" size="small" sx={{ ml: 1, height: 20 }} />
        )}
      </Typography>
      {item.subject && (
        <Typography variant="body2" color="text.secondary">
          {item.subject}
        </Typography>
      )}
      {failed && item.error && (
        <Typography variant="body2" color="error">
          {item.error}
        </Typography>
      )}
    </Box>
  );
}

export default function ActivityHistory({ appointmentId }) {
  const [userGroups] = useAtom(userGroupsAtom);
  const canView = isAuditViewer(userGroups);
  const enabled = Boolean(appointmentId) && canView;

  const result = useQuery({
    queryKey: ["auditTimeline", appointmentId],
    queryFn: async () => {
      const response = await axios.get("/api/audit/timeline/", {
        params: { appointment: appointmentId },
      });
      return response.data;
    },
    enabled,
    staleTime: 0,
    retry: 1,
    retryDelay: 1000,
  });

  if (!enabled) return null;

  const items = Array.isArray(result.data) ? result.data : [];

  return (
    <Box data-testid="activity-history" sx={{ px: { xs: 2, sm: 0 }, pb: 2 }}>
      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" component="h3" gutterBottom>
        Activity history
      </Typography>
      {result.isLoading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading activity...
          </Typography>
        </Box>
      )}
      {result.isError && (
        <Typography variant="body2" color="error">
          Could not load activity history.
        </Typography>
      )}
      {result.isSuccess && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No activity recorded yet.
        </Typography>
      )}
      {result.isSuccess && items.length > 0 && (
        <List dense disablePadding>
          {items.map((item, index) => (
            <ListItem
              key={`${item.type}-${item.id ?? index}`}
              data-testid="activity-item"
              disableGutters
              divider={index < items.length - 1}
              sx={{ alignItems: "flex-start", flexDirection: "column", py: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(item.at)} ·{" "}
                {item.type === "notification" ? item.recipient : item.actor_name}
              </Typography>
              {item.type === "notification" ? (
                <NotificationDescription item={item} />
              ) : (
                <EventDescription item={item} />
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
