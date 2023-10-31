import React, { useState, useEffect } from "react";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import dayjs from "dayjs";
import "react-big-calendar/lib/css/react-big-calendar.css";
import DateSelector from "../components/DateSelector";
import { getRequestsByDate } from "../actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Typography } from "@mui/material";
import { useAtom } from "jotai";
import { isAuthAtom, refreshAtom } from "../components/atoms.jsx";
import axios from "axios";

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
    refetchInterval: 15000,
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
      id: request.id,
    };
    ++i;
  }
  return (
    <div>
      <Calendar
        events={event}
        localizer={localizer}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "500px" }}
      />
    </div>
  );
}
