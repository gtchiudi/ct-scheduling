import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Scheduler } from "@aldabil/react-scheduler";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
} from "@mui/material";
import { useAtom } from "jotai";
import { isAuthAtom, refreshAtom } from "../components/atoms.jsx";
import axios from "axios";
import Form, { EditForm } from "../components/Form.jsx";

//const MyCalendar = () => {}
//That is the declaration for a JavaScript function. You need...
export function CustomViewer({ event }) {
  const [open, setOpen] = useState(true);
  const closeDialog = () => {
    setOpen(false);
  };

  return (
    <div>
      {open && (
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>
            PO #: {event.request.po_number}
          </DialogTitle>
          <DialogContent>
            <EditForm request={event.request} closeModal={closeDialog} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
export function CustomEditor({ event }) {
  const [open, setOpen] = useState(true);
  const closeDialog = () => {
    event.close();
    setOpen(false);
  };

  return (
    <div>
      {open && (
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>Create Request</DialogTitle>
          <DialogContent>
            <Form
              closeModal={closeDialog}
              dateTime={dayjs(event.state.start.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

export default function Calendar() {
  // React component function
  const navigate = useNavigate();
  const [, isAuth] = useAtom(isAuthAtom);
  // set start date to be previous month
  const [startDate, setStartDate] = React.useState(
    dayjs().startOf("month").subtract(1, "month")
  );
  // set end date to be 3 months from start date
  const [endDate, setEndDate] = React.useState(startDate.add(3, "month"));
  // get query client
  const queryClient = useQueryClient();
  let pauseQuery = false;

  // used as refresh token tag for error 401 handling
  const [refresh, setRefresh] = useAtom(refreshAtom);

  // store selected request
  const [selected, setSelected] = useState([]);
  // store events
  const [events, setEvents] = useState([]);
  // store query result
  let result = useState(null);
  // store if user is authorized
  let authorized = useState(null);
  // store if dialog is open
  const [open, setOpen] = useState(false);
  // close dialog
  const closeDialog = () => {
    setOpen(false);
  };

  // check authentication
  useEffect(() => {
    pauseQuery = true; // pause query
    authorized = isAuth(); // check authorization
    if (!authorized) {
      // nav to login if not authorized
      navigate("/Login");
    }
    const intervalId = setInterval(() => {
      // set interval to check auth every 30 seconds
      pauseQuery = true;
      authorized = isAuth();
      if (!authorized) {
        navigate("/Login");
      }
      pauseQuery = false;
    }, 30000);
    pauseQuery = false;
    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
      key: ["requests", "date", startDate, endDate, "active"], // store query key. updates with dates
    }),
    [startDate, endDate]
  );

  const isLoading = React.useMemo(() => {
    // check if query is loading
    if (result) {
      return result.isLoading;
    }
    return true;
  }, [result]);

  result = useQuery({
    queryKey: key,
    queryFn: async () =>
      // query for requests
      await axios.get("/api/request", {
        params: {
          approved: "True",
          active: "True",
          start_date: startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
          end_date: endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
        },
      }),
    refetchInterval: 30000, // refetches every 30 seconds
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
          authorized = isAuth(); // check auth (handles refreshing token)

          if (!authorized) {
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
      const newEvents = data.data.map((request) => ({
        // map requests to events on success
        event_id: request.id,
        title: `PO #: ${request.po_number}`, // set title to po number
        start: dayjs(request.date_time).toDate(), // start and end are same
        end: dayjs(request.date_time).toDate(),
        request: request, // store request in event
        editable: false,
        deletable: false,
        draggable: false,
      }));
      // map each result row to an event
      setEvents(newEvents); // set events
    },
  });

  return (
    <div>
      <Scheduler
        stickyNavigation={true}
        events={events}
        onSelectedDateChange={(date) => {
          updateRange(date);
        }}
        loading={isLoading}
        customViewer={(event) => <CustomViewer event={event} />}
        customEditor={(event) => <CustomEditor event={event} />}
      />
    </div>
  );
}
