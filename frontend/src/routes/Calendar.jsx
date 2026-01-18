import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Scheduler } from "@aldabil/react-scheduler";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
  Paper,
} from "@mui/material";
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
import Form from "../components/Form.jsx";

function isWarehouseChecked(id, warehousesChecked, allWarehouses) {
  if (!warehousesChecked || warehousesChecked.length === 0) {
    return true;
  }
  return warehousesChecked.includes(id);
}

export function CustomViewer({ event, onClose }) {
  // view/edit a request
  const [open, setOpen] = useState(true);
  const [editAppointment, setEditAppointment] = useAtom(editAppointmentAtom);
  const userGroups = useAtom(userGroupsAtom)[0];
  
  const closeDialog = () => {
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
            Reference number: {event.request.ref_number}
          </DialogTitle>
          <DialogContent>
            <Form request={event.request} closeModal={closeDialog} />
          </DialogContent>
          <DialogActions>
            {!editAppointment && event.request.check_in_time == null && userGroups.includes("Admin", "Dispatch") && (
              <Button onClick={enableEdit}> Edit Appointment</Button>
            )}
            <Button onClick={closeDialog}>Cancel</Button>
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
  const navigate = useNavigate();
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
  let result = useState(null); // query result storage

  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [warehousesChecked, setWarehousesChecked] = useAtom(warehouseCheckedAtom);

  const [parsedWarehouseData, setParsedWarehouseData] = useState([]); // parsed warehouse data storage

  const ref = React.useRef(null);
  // check authentication
  useEffect(() => {
    refreshWarehouseData();
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
    // check if query is loading
    if (result) {
      return result.isLoading;
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
      const newEvents = data.data.map((request) => ({
        // map requests to events on success
        event_id: request.id,
        title: `Ref #: ${request.ref_number}`, // set title to po number
        start: new Date(request.date_time), // start and end are same
        end: new Date(dayjs(request.date_time).add(15, "minutes")),
        request: request, // store request in event
        editable: false,
        deletable: false,
        draggable: false,
        color: isLate(request.date_time, request.check_in_time) ? "#FF0000" : "#00FF00",
      }));
      // map each result row to an event
      setAllEvents(newEvents); // set events
    },
  });

  return (
    <Box id="body">
      <Box
        id="checkboxes"
        display="flex"
        justifyContent="flex-end"
        marginBottom={0}
        backgroundColor="white"
        position="fixed"
        right={0}
        top="70.29px"
        zIndex={1000}
        width="100%"
      >
        {parsedWarehouseData.map((warehouse) => (
          <Box key={warehouse.id} marginRight={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={warehouse.checked}
                  onChange={handleCheckboxChange(warehouse.id)}
                />
              }
              label={warehouse.name}
            />
          </Box>
        ))}
      </Box>
      <Box id="calendar" paddingTop="129px">
        <Scheduler
          hourFormat="24"
          events={events}
          month={{
            weekDays: [1, 2, 3, 4, 5, 6, 0],
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
          onSelectedDateChange={(date) => {
            updateRange(date);
          }}
          loading={isLoading}
          customViewer={(event, closeViewer) => {
            return <CustomViewer event={event} onClose={closeViewer} />;
          }}
          customEditor={(event) => <CustomEditor event={event} />}
        />
      </Box>
    </Box>
  );
}
