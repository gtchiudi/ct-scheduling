import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";
import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

function AppointmentSearchDrawer({ open, onClose, onSelectRequest }) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(rawQuery), 300);
    return () => clearTimeout(timeout);
  }, [rawQuery]);

  useEffect(() => {
    if (!open) {
      setRawQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const trimmedQuery = debouncedQuery.trim();
  const queryEnabled = open && trimmedQuery.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["requestSearch", trimmedQuery],
    queryFn: () =>
      axios.get("/api/request/", {
        params: { approved: "True", search: trimmedQuery },
      }),
    enabled: queryEnabled,
    keepPreviousData: true,
  });

  const results = queryEnabled ? data?.data ?? [] : [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // MUI's Modal (which backs Drawer) moves focus to itself once the enter
      // transition finishes, which happens after — and overrides — a plain
      // `autoFocus` on the input. Focusing here, once the slide-in is done,
      // is what actually wins.
      SlideProps={{ onEntered: () => searchInputRef.current?.focus() }}
    >
      <Box sx={{ width: 400, p: 2 }} role="presentation">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <TextField
            autoFocus
            inputRef={searchInputRef}
            fullWidth
            placeholder="Search customer, carrier, or reference #"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <IconButton onClick={onClose} aria-label="Close search">
            <CloseIcon />
          </IconButton>
        </Box>

        {isFetching && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!isFetching && rawQuery.trim().length > 0 && rawQuery.trim().length < 2 && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Keep typing to search…
          </Typography>
        )}

        {!isFetching && queryEnabled && results.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No appointments found.
          </Typography>
        )}

        <List>
          {results.map((row) => (
            <ListItemButton key={row.id} onClick={() => onSelectRequest(row)} divider>
              <ListItemText
                primary={row.customer_name || row.company_name}
                secondary={
                  <>
                    {row.company_name && row.customer_name ? `${row.company_name} — ` : ""}
                    Ref #: {row.ref_number ? row.ref_number.split(";")[0].trim() : "—"}
                    {" · "}
                    {row.date_time ? dayjs(row.date_time).format("MMM D, YYYY h:mm A") : ""}
                  </>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default AppointmentSearchDrawer;
