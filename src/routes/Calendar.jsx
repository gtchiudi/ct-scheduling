import React, { useState, useEffect } from "react";
import { Calendar, Views, dayjsLocalizer } from "react-big-calendar";
import dayjs from "dayjs";
import "react-big-calendar/lib/css/react-big-calendar.css";
import DateSelector from "../components/DateSelector";
import { getRequestsByDate } from "../actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
} from "@mui/material";
import { useAtom } from "jotai";
import { isAuthAtom, refreshAtom } from "../components/atoms.jsx";
import axios from "axios";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { EditForm } from "../components/Form.jsx";

//const MyCalendar = () => {}
//That is the declaration for a JavaScript function. You need...

export default function MyCalendar() {
  // React component function
  const clocalizer = dayjsLocalizer(dayjs);

  const [startDate, setStartDate] = React.useState(dayjs().startOf("month"));
  const [endDate, setEndDate] = React.useState(startDate.add(1, "month"));
  console.log("Start Date: ", startDate);
  console.log("End Date: ", endDate);
  const queryClient = useQueryClient();
  let pauseQuery = false;
  const navigate = useNavigate();
  const [refresh, setRefresh] = useAtom(refreshAtom);
  const [, isAuth] = useAtom(isAuthAtom);
  const [open, setOpen] = useState(false);
  const closeDialog = () => {
    setOpen(false);
  };
  const [selected, setSelected] = useState([]);
  const [events, setEvents] = useState([]);

  const updateRange = (range) => {
    const newStart = dayjs(
      (dayjs(range.start).valueOf() + dayjs(range.end).valueOf()) / 2
    );
    if (newStart.isBefore(startDate)) {
      setStartDate(newStart.startOf("month"));
      setEndDate(newStart.endOf("month"));
      queryClient.invalidateQueries(["requests", "date"]);
    } else if (newStart.isAfter(endDate)) {
      setStartDate(newStart.startOf("month"));
      setEndDate(newStart.endOf("month"));
      queryClient.invalidateQueries(["requests", "date"]);
    }
  };

  const { max, views, defaultView, key } = React.useMemo(
    () => ({
      max: dayjs().endOf("day").subtract(1, "hours").toDate(),
      views: [Views.MONTH, Views.WEEK, Views.DAY],
      defaultView: Views.MONTH,
      key: ["requests", "date", startDate, endDate, "active"],
    }),
    [startDate, endDate]
  );

  let result = useQuery({
    queryKey: key,
    queryFn: async () =>
      await axios.get("/api/request", {
        params: {
          approved: "True",
          active: "True",
          start_date: startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
          end_date: endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
        },
      }),
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 1000,
    enabled: !pauseQuery,
    onError: (error) => {
      if (error.response && error.response.status === 401) {
        // Check if token refresh is already in progress
        pauseQuery = true;
        if (!refresh) {
          setRefresh(true);
          authorized = isAuth();

          if (!authorized) {
            queryClient.cancelQueries(["requests", "date", startDate, endDate]);
            navigate("/logout");
          }
        }
        pauseQuery = false;
        queryClient.invalidateQueries(["requests", "date", startDate, endDate]);
      }
    },
    onSuccess: (data) => {
      console.log(data);
      const newEvents = data.data.map((request) => ({
        title: request.po_number,
        start: dayjs(request.date_time),
        end: dayjs(request.date_time),
        request: request,
      }));
      // map each result row to an event
      setEvents(newEvents);
    },
  });

  if (!result) return null;
  if (result.isLoading) return <div>Loading...</div>;
  if (result.isError) return <div>Error: {result.error.message}</div>;

  return (
    <div>
      {open && (
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>
            Edit and Approve Request
          </DialogTitle>
          <DialogContent>
            <EditForm request={selected} closeModal={closeDialog} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
      <Calendar
        events={events}
        localizer={clocalizer}
        views={views}
        max={max}
        startAccessor={(event) => {
          return new dayjs(event.start);
        }}
        endAccessor={(event) => {
          return new dayjs(event.end);
        }}
        style={{ height: "90vh" }}
        defaultView={defaultView}
        onRangeChange={(range) => {
          console.log(range);
          updateRange(range);
        }}
        onSelectEvent={(event) => {
          setSelected(event.request);
          setOpen(true);
        }}
      />
    </div>
  );
}
