import React, { useState, useEffect } from "react";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
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
  const localizer = dayjsLocalizer(dayjs);

  const [startDate, setStartDate] = React.useState(dayjs().startOf("month"));
  const [endDate, setEndDate] = React.useState(startDate.add(1, "month"));
  console.log("Start Date: ", startDate);
  console.log("End Date: ", endDate);
  const queryClient = useQueryClient();
  let pauseQuery = false;
  const navigate = useNavigate();
  const formattedStartDate = startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  const formattedEndDate = endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  const [refresh, setRefresh] = useAtom(refreshAtom);
  const [, isAuth] = useAtom(isAuthAtom);
  const [open, setOpen] = useState(false);
  const closeDialog = () => {
    setOpen(false);
  };
  const [selected, setSelected] = useState([]);

  let result = useQuery({
    queryKey: ["requests", "date", startDate, endDate, "active"],
    queryFn: async () =>
      await axios.get("/api/request", {
        params: {
          approved: "True",
          active: "True",
          start_date: formattedStartDate,
          end_date: formattedEndDate,
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
  });

  if (!result) return null;
  if (result.isLoading) return <div>Loading...</div>;
  if (result.isError) return <div>Error: {result.error.message}</div>;

  let i = 0;
  let event = [];
  console.log("Request data response: ", result.data.data);

  for (const request of result.data.data) {
    // map each result row to an event
    event[i] = {
      title: request.po_number,
      start: dayjs(request.date_time),
      end: dayjs(request.date_time),
      request: request,
    };
    ++i;
  }
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
        events={event}
        localizer={localizer}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "90vh" }}
        //onRangeChange
        onSelectEvent={(event) => {
          setSelected(event.request);
          setOpen(true);
        }}
      />
    </div>
  );
}
