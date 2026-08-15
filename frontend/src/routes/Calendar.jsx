import React, { useState, useEffect, useLayoutEffect } from "react";
import dayjs from "dayjs";
import { Scheduler } from "@aldabil/react-scheduler";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Box,
  Checkbox,
  Dialog,
  IconButton,
  LinearProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
  Paper,
  Tooltip,
  Divider,
  useMediaQuery,
  Menu,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { alpha, createTheme, ThemeProvider, useTheme } from "@mui/material/styles";
import { useAtom } from "jotai";
import {
  authenticatedAtom,
  isAuthAtom,
  refreshAtom,
  warehouseDataEffectAtom,
  warehouseCheckedAtom,
  userGroupsAtom,
  editAppointmentAtom,
} from "../components/atoms.jsx";
import axios from "axios";
import Form, { APPOINTMENT_LENGTH_OPTIONS } from "../components/Form.jsx";
import AppointmentSearchDrawer from "../components/AppointmentSearchDrawer.jsx";

function isWarehouseChecked(id, warehousesChecked, allWarehouses) {
  if (!warehousesChecked || warehousesChecked.length === 0) {
    return true;
  }
  return warehousesChecked.includes(id);
}

export function CustomViewer({ event, onClose }) {
  // view/edit a request
  const [open, setOpen] = useState(true);
  const pendingAcknowledge = React.useRef(null);
  const [editAppointment, setEditAppointment] = useAtom(editAppointmentAtom);
  const userGroups = useAtom(userGroupsAtom)[0];

  const handleLockChange = (acknowledgeFn) => {
    pendingAcknowledge.current = acknowledgeFn;
  };

  const closeDialog = () => {
    if (pendingAcknowledge.current) {
      const ack = pendingAcknowledge.current;
      pendingAcknowledge.current = null;
      ack();
      return;
    }
    setEditAppointment(false);
    if (typeof onClose === "function") onClose();
    setOpen(false);
  };

  const enableEdit = () => {
    setEditAppointment(true);
  };

  return (
    <div>
      {open && (
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>
            Reference / PO Number: {event.request.ref_number
              ? event.request.ref_number.split(";").map(s => s.trim()).filter(Boolean).join(", ")
              : ""}
          </DialogTitle>
          <DialogContent sx={{ pt: '20px !important', px: { xs: 0, sm: 3 }, pb: 0 }}>
            <Form request={event.request} closeModal={closeDialog} onLockChange={handleLockChange} />
          </DialogContent>
          <DialogActions>
            {!editAppointment && event.request.check_in_time == null && userGroups.some(g => ["Admin", "Dispatch"].includes(g)) && (
              <Button onClick={enableEdit}> Edit Appointment</Button>
            )}
            <Button onClick={closeDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

export function CustomEditor({ event }) {
  // create a new request. Automatically approved
  const [open, setOpen] = useState(true);
  const closeDialog = () => {
    event.close();
    setOpen(false);
  };

  return (
    <div>
      {open && (
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>Create Appointment</DialogTitle>
          <DialogContent sx={{ pt: '20px !important', px: { xs: 0, sm: 3 }, pb: 0 }}>
            <Form
              closeModal={closeDialog}
              dateTime={dayjs(event.state.start.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

const warningTheme = (outerTheme) => createTheme(outerTheme, {
  palette: {
    secondary: {
      main: "#ed6c02",
    },
  },
});

export default function Calendar() {
  const navigate = useNavigate();
  const theme = useTheme();
  // Only seeds the *initial* view — resizing an already-open desktop window
  // narrower shouldn't yank the user into Day/Agenda mid-session, it should
  // only affect what a fresh page load defaults to.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [, isAuth] = useAtom(isAuthAtom);
  const [authenticated] = useAtom(authenticatedAtom);
  // set start date to be previous month and set end date to be 3 months from start date
  const [startDate, setStartDate] = React.useState(
    dayjs().startOf("month").subtract(1, "month")
  );
  const [endDate, setEndDate] = React.useState(startDate.add(3, "month"));

  const queryClient = useQueryClient();
  let pauseQuery = false;

  const [refresh, setRefresh] = useAtom(refreshAtom); // is refreshing
  const [allEvents, setAllEvents] = useState([]); // calendar event storage of all events
  const [viewerEvent, setViewerEvent] = useState(null);
  const [agendaViewerEvent, setAgendaViewerEvent] = useState(null);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [warehouseMenuAnchor, setWarehouseMenuAnchor] = useState(null);
  const schedulerViewRef = React.useRef(isMobile ? "day" : "week");
  const [currentView, setCurrentView] = useState(isMobile ? "day" : "week");
  const [isAgendaMode, setIsAgendaMode] = useState(isMobile);
  // Tracks which date is currently selected in the scheduler, purely so the
  // header-height measurement effect below can re-run when the user
  // navigates — the number of stacked all-day appointments (and therefore
  // the native header's height) can differ per date even when nothing else
  // about the events/view/agenda-mode changes.
  const [visibleDate, setVisibleDate] = useState(dayjs());
  let result = useState(null); // query result storage

  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [warehousesChecked, setWarehousesChecked] = useAtom(warehouseCheckedAtom);

  const [parsedWarehouseData, setParsedWarehouseData] = useState([]); // parsed warehouse data storage

  const ref = React.useRef(null);
  const checkboxesRef = React.useRef(null);
  const calendarBoxRef = React.useRef(null);
  const [calendarTopOffset, setCalendarTopOffset] = React.useState(135);
  // Whether the all-day section shows every stacked lane or just the first
  // one — toggled by the user via a small chevron; whether that chevron is
  // even shown depends on whether there's more than one lane to begin with.
  const [allDayExpanded, setAllDayExpanded] = React.useState(true);
  const [allDayHasOverflow, setAllDayHasOverflow] = React.useState(false);
  // Viewport `top` for the toggle chevron, kept in sync with wherever the
  // all-day/hourly-grid divider currently sits (same value driving
  // calendarTopOffset below, just not offset by the calendar box's own top).
  const [allDayDividerTop, setAllDayDividerTop] = React.useState(null);
  // check authentication
  useEffect(() => {
    refreshWarehouseData();
    queryClient.invalidateQueries(["requests", "date"]);
  }, []);

  useEffect(() => {
    pauseQuery = true; // pause query

    if (!authenticated) {
      // nav to login if not authorized
      navigate("/Login");
    }
    const intervalId = setInterval(() => {
      // set interval to check auth every 3 minutes
      pauseQuery = true;
      isAuth();
      if (!authenticated) {
        navigate("/Login");
      }
      pauseQuery = false;
    }, 300000);
    pauseQuery = false;
    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Map warehouses to checkboxes
  useEffect(() => {
    const allWarehouses = warehouseData || [];
    const checkedList = warehousesChecked || [];

    setParsedWarehouseData(
      allWarehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        color: warehouse.color,
        checked: isWarehouseChecked(warehouse.id, checkedList),
      }))
    );

    if (checkedList == []){
      setWarehousesChecked(allWarehouses.map(warehouse => warehouse.id))
    }
  }, []);

  const handleCheckboxChange = (id) => (event) => {
    setParsedWarehouseData(
      parsedWarehouseData.map((warehouse) =>
        warehouse.id === id
          ? { ...warehouse, checked: event.target.checked }
          : warehouse
      )
    );

    setWarehousesChecked((prev = []) => {
      if (event.target.checked) {
        if (!prev || prev.length === 0) {
          return parsedWarehouseData
            .filter(w => w.id !== id && w.checked)
            .map(w => w.id)
            .concat(id);
        }
        return [...prev, id];
      } else {
        return prev.filter((warehouseId) => warehouseId !== id);
      }
    });
  };
  const updateRange = (date) => {
    const newDate = dayjs(date); // store date as dayjs object
    if (newDate.isBefore(startDate) || newDate.isAfter(endDate)) {
      // check if outside curr range
      setStartDate(newDate.startOf("month").subtract(1, "month")); // one month before curr
      setEndDate(startDate.add(3, "month")); // 3 months after start
      pauseQuery = true; // pause query
      queryClient.invalidateQueries(["requests", "date"]); // invalidate query
    }
    pauseQuery = false; // unpause query
  };

  const { key } = React.useMemo(
    () => ({
      key: ["requests", "date", startDate, endDate], // store query key. updates with dates
    }),
    [startDate, endDate]
  );

  const isLoading = React.useMemo(() => {
    // check if query is loading or refetching
    if (result) {
      return result.isLoading || result.isFetching;
    }
    return true;
  }, [result]);

  const events = React.useMemo(() => {
    // filter events based on warehouse
    const includeWarehouses = parsedWarehouseData.filter((warehouse) => {
      return warehouse.checked;
    });
    return allEvents.filter((event) => {
      for (const warehouse of includeWarehouses) {
        if (event.request.warehouse == warehouse.id) return true;
      }
      return false;
    });
  }, [allEvents, parsedWarehouseData]);

  // The scheduler renders its own toolbar/day-header as a fixed-position
  // block whose height grows with the number of stacked all-day appointments
  // for the visible period — it isn't affected by our own padding, so that
  // padding has to be measured from the actual rendered header rather than a
  // static guess, and re-measured whenever the rendered appointments (or the
  // view) change.
  useLayoutEffect(() => {
    const node = calendarBoxRef.current;
    if (!node) return;

    // `.rs__header` also matches the per-row time-gutter cells inside the
    // scrollable grid body (e.g. the "06:00" labels) — those live inside a
    // normally-positioned scroll container, not the toolbar/day-header block,
    // which is `position: fixed`. Restrict to elements whose nearest
    // positioned ancestor (within the calendar box) is actually fixed, or the
    // measurement runs away chasing hour rows far down the scrollable body.
    const isInFixedHeader = (el) => {
      let ancestor = el;
      while (ancestor && ancestor !== node) {
        if (getComputedStyle(ancestor).position === "fixed") return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    };

    // `.rs__multi_day` chips (stacked all-day/multi-day events) are
    // absolutely positioned inside `.rs__header`, so they don't contribute
    // to its own auto height — a header row with 2+ stacked lanes needs its
    // tallest chip included here directly, or the grid body underneath
    // isn't pushed down far enough to clear it. `.rs__view_navigator` (the
    // Today/Month/Week/Day toolbar) is a separate fixed element stacked
    // above the day-header row — it's included when measuring the overall
    // offset below (its own bottom can matter too), but must NEVER be part
    // of the day-cell stretch further down, or forcing its height to match
    // a tall stacked-chip row pushes its own button labels out of view.
    const getHeaderCellEls = () =>
      Array.from(node.querySelectorAll(".rs__header")).filter(isInFixedHeader);
    const getNavigatorEls = () =>
      Array.from(node.querySelectorAll(".rs__view_navigator")).filter(isInFixedHeader);
    const getChipEls = () =>
      Array.from(node.querySelectorAll(".rs__multi_day")).filter(isInFixedHeader);

    const measure = () => {
      const headerCellEls = getHeaderCellEls();
      const navigatorEls = getNavigatorEls();
      if (!headerCellEls.length && !navigatorEls.length) return;
      const headerWrapper = node.querySelector('div[data-testid="grid"] > :first-child');

      // The library locks each header cell's height *and* its wrapper's
      // `grid-template-rows` to a single-lane measurement — both computed
      // once and applied as high-specificity inline styles, which a
      // stylesheet override can't reliably out-cascade (grid's auto-track
      // sizing and the cell's own stretch-to-fill-track end up circularly
      // dependent on each other otherwise). Clearing any previous override
      // before re-measuring avoids treating our own last stretch as the
      // "natural" size on the next pass.
      headerWrapper?.style.removeProperty("grid-template-rows");
      headerCellEls.forEach((el) => el.style.removeProperty("height"));

      const calendarTop = node.getBoundingClientRect().top;
      let baseBottom = 0;
      [...headerCellEls, ...navigatorEls].forEach((el) => {
        const bottom = el.getBoundingClientRect().bottom;
        if (bottom > baseBottom) baseBottom = bottom;
      });

      // Whether there's more than one stacked lane can't be inferred from
      // "does the tallest chip's bottom exceed the header cell's own
      // bottom" — Day view's single-column grid has no competing sibling
      // cells to hold its row height down, so once the library's pinned
      // height is removed above, the cell auto-grows to already fit every
      // stacked lane, making that comparison always come out equal. Lane
      // *positions* are reliable in every view instead: chips share the
      // same viewport `top` across every day column that has one at a
      // given stack depth, so distinct top values directly count lanes.
      const chipEls = getChipEls();
      let maxChipBottom = 0;
      const laneTops = [];
      chipEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > maxChipBottom) maxChipBottom = rect.bottom;
        const top = Math.round(rect.top);
        if (!laneTops.includes(top)) laneTops.push(top);
      });
      laneTops.sort((a, b) => a - b);
      const hasOverflow = laneTops.length > 1;
      setAllDayHasOverflow(hasOverflow);

      // Collapsed target: the header cell's own box is forced down to
      // exactly where the 2nd lane starts, so it's fully clipped — a no-op
      // in views where that already matches the natural single-lane size,
      // but load-bearing in Day view where "natural" already means "every
      // lane" per the comment above.
      const targetBottom = hasOverflow && !allDayExpanded
        ? laneTops[1]
        : Math.max(baseBottom, maxChipBottom);

      if (headerWrapper && headerCellEls.length) {
        const wrapperTop = headerWrapper.getBoundingClientRect().top;
        const rowHeight = Math.ceil(targetBottom - wrapperTop);
        headerWrapper.style.setProperty("grid-template-rows", `${rowHeight}px`, "important");
        headerCellEls.forEach((el) => {
          // These cells are `box-sizing: content-box`, so a `height` equal
          // to the full row height renders 1px taller once the border-
          // bottom (the divider itself) is added on top — just past the
          // wrapper's `overflow: hidden` clip boundary when collapsed,
          // which silently swallows that exact pixel and makes the divider
          // vanish. Shrinking by the cell's own border keeps its *total*
          // rendered box (content + border) matching the row height.
          const cellCs = getComputedStyle(el);
          const borderAdjust = cellCs.boxSizing === "border-box"
            ? 0
            : (parseFloat(cellCs.borderTopWidth) || 0) + (parseFloat(cellCs.borderBottomWidth) || 0);
          el.style.setProperty("height", `${Math.max(0, rowHeight - borderAdjust)}px`, "important");
        });
      }
      // Collapsed: clip extra lanes at the header cells' own (now shrunk)
      // bounds instead of letting them spill over the grid body underneath
      // — this is what actually "collapses" the section.
      headerWrapper?.style.setProperty(
        "overflow",
        hasOverflow && !allDayExpanded ? "hidden" : "visible",
        "important"
      );

      if (targetBottom > 0) {
        setCalendarTopOffset(Math.ceil(targetBottom - calendarTop) + 0.25);
        setAllDayDividerTop(Math.ceil(targetBottom));
      }
    };

    measure();
    let mutationRaf = null;
    let settleTimeouts = [];
    const scheduleMeasure = () => {
      if (mutationRaf) cancelAnimationFrame(mutationRaf);
      mutationRaf = requestAnimationFrame(measure);
      // Stacked all-day chips can arrive across more than one of the
      // library's own internal render passes (e.g. lanes 2 and 3 landing
      // in separate commits after lane 1) — a single immediate re-measure
      // can lock in an intermediate, still-too-short height if it runs
      // between passes. A few staggered follow-ups catch whatever a single
      // rAF misses without needing to know how many passes there'll be.
      settleTimeouts.forEach(clearTimeout);
      settleTimeouts = [100, 300, 600].map((delay) => setTimeout(measure, delay));
    };
    const raf = requestAnimationFrame(measure); // catch layout that settles a tick later

    // Only `node` itself is observed for resize — measure() now writes
    // inline height/grid-template-rows onto the header cells directly
    // (see above), and observing those same elements here would mean our
    // own writes trigger their own resize notifications right back into
    // this callback.
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    // The scheduler positions stacked all-day chips (`.rs__multi_day`) in
    // internal passes that can land after our own commit — a ResizeObserver
    // alone won't catch that, since a chip appearing/repositioning doesn't
    // resize its parent (it's absolutely positioned, so it never affects
    // the parent's own box size). Observing `node` itself (rather than the
    // specific fixed-header wrapper) survives React replacing that wrapper
    // node across re-renders; the `isInFixedHeader` filter keeps the
    // (frequent) scrollable-body mutations from triggering wasted
    // re-measures. `attributes` is deliberately excluded — measure() writes
    // style attributes onto this same subtree, which would otherwise
    // retrigger itself on every pass.
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((m) => isInFixedHeader(m.target))) scheduleMeasure();
    });
    mutationObserver.observe(node, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      if (mutationRaf) cancelAnimationFrame(mutationRaf);
      settleTimeouts.forEach(clearTimeout);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [events, currentView, isAgendaMode, visibleDate, allDayExpanded]);

  const isLate = (requestDateTime, requestCheckInTime = null) => {
    if (requestDateTime === null) {
      return false
    } else if (requestCheckInTime === null) {
      return dayjs().isAfter(dayjs(requestDateTime).add(10, "minutes"));
    } else {
      return (
        dayjs(requestCheckInTime).isAfter(
          dayjs(requestDateTime).add(10, "minutes")
        )
      );
    }
  };

  const getEventColor = (request) => {
    if (request.completed_time !== null) {
      return "#808080"; // Gray for completed requests
    }
    else if (isLate(request.date_time, request.check_in_time)) {
      return "#FF0000"; // Red for late requests
    } else {
      const warehouse = warehouseData.find(w => w.id === request.warehouse);
      return warehouse.color // ? warehouse.color : "#00FF00"; // Return warehouse color or default green
    }
  };

  const getEventStatus = (event) => {
    if (event.request.check_in_time == null){
      if (isLate(event.request.date_time, event.request.check_in_time))
        return 'Late'
      return 'On Time'
    }
    else if (event.request.docked_time == null)
      return 'Checked In'
    else if (event.request.completed_time == null)
      return 'Docked'
    else
      return 'Completed'
  }

  result = useQuery({
    queryKey: key,
    queryFn: async () =>
      // query for requests
      await axios.get("/api/request", {
        params: {
          approved: "True",
          start_date: startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
          end_date: endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
        },
      }),
    refetchInterval: 180000, // refetches every 3 minutes
    staleTime: 120000, // data considered fresh for 2 minutes
    retry: 3, // retry 3 times
    retryDelay: 1000, // retry every 1 second
    enabled: !pauseQuery, // enable query if not paused
    onError: (error) => {
      // handle error 401
      if (error.response && error.response.status === 401) {
        // Check if token refresh is already in progress
        pauseQuery = true; // pause query
        if (!refresh) {
          // check if already refreshing
          setRefresh(true); // set refresh to true
          isAuth(); // check auth (handles refreshing token)

          if (!authenticated) {
            // refresh failed
            queryClient.cancelQueries(["requests", "date"]); // cancel query
            navigate("/logout"); // logout
          }
        }
        queryClient.invalidateQueries(["requests", "date", startDate, endDate]);
        pauseQuery = false; // unpause query
      }
    },
    onSuccess: (data) => {
      const newEvents = data.data.map((request) => {
        const color = getEventColor(request);
        const isAllDay = request.container_drop === true;
        return {
          event_id: request.id,
          title: request.ref_number ? request.ref_number.split(";")[0].trim() : "",
          start: new Date(request.date_time),
          end: new Date(dayjs(request.date_time).add(request.appointment_length, "minutes")), // Use the .add here to add appt window length to start time.
          request: request,
          editable: false,
          deletable: false,
          draggable: false,
          color,
          allDay: isAllDay,
          // The scheduler's own default chip is used for all-day/multi-day
          // events (our custom eventRenderer is skipped for those) — this sx
          // is merged into that default rendering, so style it to match the
          // tinted/left-border look our eventRenderer uses everywhere else.
          ...(isAllDay && {
            sx: {
              bgcolor: alpha(color, 0.08),
              color: "rgba(0, 0, 0, 0.87)",
              borderLeft: `4px solid ${color}`,
              borderRadius: "0 4px 4px 0",
              boxShadow: "none",
            },
          }),
        };
      });
      setAllEvents(newEvents);
    },
  });

  const isCalendarLoading = result.isLoading || result.isFetching;

  return (
    <Box id="body">
      <Dialog open={newAppointmentOpen} onClose={() => setNewAppointmentOpen(false)}>
        <DialogTitle textAlign="center">Create Appointment</DialogTitle>
        <DialogContent sx={{ pt: '20px !important', px: { xs: 0, sm: 3 }, pb: 0 }}>
          <Form
            closeModal={() => { queryClient.invalidateQueries(["requests"]); setNewAppointmentOpen(false); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewAppointmentOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Box
        ref={checkboxesRef}
        id="checkboxes"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor="white"
        position="fixed"
        left={0}
        right={0}
        top={{ xs: "58px", sm: "66px" }}
        // The scheduler library's own toolbar renders at a fixed position
        // (~112px) that's independent of our layout — this bar's bottom edge
        // needs to reach past that regardless of breakpoint, or a gap opens
        // up between this bar and the scheduler underneath it. 66+50=116px
        // already clears it on desktop; mobile's shorter app-header (58px
        // top here vs 66px) needs a taller bar to reach the same point.
        height={{ xs: "56px", sm: "50px" }}
        zIndex={1000}
        px={2}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="contained"
            size={isMobile ? "small" : "medium"}
            onClick={() => setNewAppointmentOpen(true)}
          >
            {isMobile ? "New" : "New Appointment"}
          </Button>
          <IconButton aria-label="Search appointments" onClick={() => setSearchDrawerOpen(true)}>
            <SearchIcon />
          </IconButton>
        </Box>
        {isMobile ? (
          <>
            <IconButton
              aria-label="Filter warehouses"
              onClick={(e) => setWarehouseMenuAnchor(e.currentTarget)}
            >
              <FilterListIcon />
            </IconButton>
            <Menu
              anchorEl={warehouseMenuAnchor}
              open={Boolean(warehouseMenuAnchor)}
              onClose={() => setWarehouseMenuAnchor(null)}
            >
              {parsedWarehouseData.map((warehouse) => (
                <MenuItem key={warehouse.id} onClick={(e) => e.stopPropagation()} dense>
                  <FormControlLabel
                    sx={{ width: "100%", mr: 0 }}
                    control={
                      <Checkbox
                        checked={warehouse.checked}
                        onChange={handleCheckboxChange(warehouse.id)}
                      />
                    }
                    label={warehouse.name}
                  />
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Box display="flex" alignItems="center" gap={1}>
            {parsedWarehouseData.map((warehouse) => (
              <FormControlLabel
                key={warehouse.id}
                control={
                  <Checkbox
                    checked={warehouse.checked}
                    onChange={handleCheckboxChange(warehouse.id)}
                  />
                }
                label={warehouse.name}
              />
            ))}
          </Box>
        )}
      </Box>
      {!isAgendaMode && allDayHasOverflow && allDayDividerTop != null && (
        <IconButton
          aria-label={allDayExpanded ? "Collapse all-day events" : "Expand all-day events"}
          onClick={() => setAllDayExpanded((prev) => !prev)}
          size="small"
          sx={{
            position: "fixed",
            top: `${allDayDividerTop - 14}px`,
            right: 8,
            zIndex: 1001,
            backgroundColor: "background.paper",
            boxShadow: 1,
            "&:hover": { backgroundColor: "grey.100" },
          }}
        >
          {allDayExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      )}
      <AppointmentSearchDrawer
        open={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        onSelectRequest={(row) => {
          setSearchDrawerOpen(false);
          setViewerEvent({ request: row });
        }}
      />
      <Box id="calendar"
        ref={calendarBoxRef}
        paddingTop={`${calendarTopOffset}px`}
        className={isAgendaMode ? "agenda-mode" : ""}
      >
        {isCalendarLoading && <LinearProgress sx={{ mb: 0.5 }} />}
        <ThemeProvider theme={warningTheme}>
        <Scheduler
          ref={ref}
          hourFormat="24"
          events={events}
          view={currentView}
          agenda={isAgendaMode}
          disableViewer
          onEventClick={(event) => setViewerEvent(event)}
          eventRenderer={({ event, onClick, draggable }) => {
            const isAgenda = draggable === undefined;

            const paperSx = {
              borderLeft: `4px solid ${event.color}`,
              backgroundColor: alpha(event.color, 0.08),
              padding: "2px 6px",
              cursor: "pointer",
              width: "100%",
              height: "100%",
              borderRadius: "0 4px 4px 0",
              overflow: "hidden",
              boxSizing: "border-box",
            };

            if (isAgenda) {
              return (
                <Paper
                  key={event.event_id}
                  onClick={() => setAgendaViewerEvent(event)}
                  elevation={1}
                  sx={{ ...paperSx, height: "auto", padding: "6px 10px" }}
                >
                  {(event.request.ref_number
                    ? event.request.ref_number.split(";").map(s => s.trim()).filter(Boolean)
                    : [event.title]
                  ).map((ref, i, arr) => (
                    <Typography key={ref} variant="subtitle2" fontWeight="bold">
                      {arr.length === 1 ? "Reference / PO Number" : `Reference / PO Number ${i + 1}`}: {ref}
                    </Typography>
                  ))}
                  {[
                    `Customer: ${event.request.customer_name ?? event.request.company_name}`,
                    event.request.container_drop
                      ? "Appointment Time: All Day"
                      : `Appointment Time: ${dayjs(event.start).format("HH:mm")}`,
                    `Appointment Window: ${APPOINTMENT_LENGTH_OPTIONS.find(opt => opt.value === event.request.appointment_length)?.label}`,
                    `Appointment Status: ${getEventStatus(event)}`,
                  ].map((line) => (
                    <Typography key={line} variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
                      {line}
                    </Typography>
                  ))}
                  {event.request.note_section && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ lineHeight: 1.2 }}
                      >
                        Notes:
                      </Typography>
                      <Typography variant="caption" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.2 }}>
                        {event.request.note_section}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              );
            }

            if (schedulerViewRef.current === "day") {
              return (
                <Paper
                  key={event.event_id}
                  onClick={() => setViewerEvent(event)}
                  elevation={1}
                  sx={paperSx}
                >
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                    sx={{ lineHeight: 1.3 }}
                  >
                    Reference #: {event.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Customer: {event.request.customer_name ? event.request.customer_name : event.request.company_name }
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ lineHeight: 1.2 }}
                  >
                    Appointment Status: {getEventStatus(event)}
                  </Typography>
                </Paper>
              );
            }

            // month and week view — title only, tooltip shows time
            const isMonth = schedulerViewRef.current === "month";

            return (
              <Tooltip
                key={event.event_id}
                title={dayjs(event.start).format("HH:mm")}
                placement="bottom"
                arrow
                disableInteractive
                slotProps={{
                  popper: {
                    modifiers: [
                      {
                        name: 'offset',
                        options: {
                          offset: [0, -8],
                        },
                      },
                    ],
                  },
                }}
              >
                <Paper
                  onClick={() => setViewerEvent(event)}
                  elevation={1}
                  sx={{
                    ...paperSx,
                    height: isMonth ? "auto" : "100%",
                    padding: isMonth ? "1px 4px" : "2px 6px",
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                    sx={{ lineHeight: 1.3 }}
                  >
                    Ref #: {event.title}
                  </Typography>
                </Paper>
              </Tooltip>
            );
          }}
          month={{
            weekDays: [0, 1, 2, 3, 4, 5, 6],
            weekStartOn: 6,
            startHour: 6,
            endHour: 18,
          }}
          week={{
            weekDays: [2, 3, 4, 5, 6],
            weekStartOn: 6,
            startHour: 6,
            endHour: 18,
            step: 30,
          }}
          day={{
            startHour: 6,
            endHour: 18,
            step: 15,
          }}
          onViewChange={(view, agenda) => { schedulerViewRef.current = view; setCurrentView(view); setIsAgendaMode(!!agenda); }}
          onSelectedDateChange={(date) => {
            updateRange(date);
            setVisibleDate(dayjs(date));
          }}
          customEditor={(event) => <CustomEditor event={event} />}
        />
        {viewerEvent && (
          <CustomViewer
            event={viewerEvent}
            onClose={() => setViewerEvent(null)}
          />
        )}
        {agendaViewerEvent && (
          <CustomViewer
            event={agendaViewerEvent}
            onClose={() => setAgendaViewerEvent(null)}
          />
        )}
        </ThemeProvider>
      </Box>
    </Box>
  );
}
