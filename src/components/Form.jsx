import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
//import dayjs from "dayjs";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Checkbox,
  Box,
  FormControl,
  MenuItem,
  Typography,
  Stack,
  Container,
} from "@mui/material";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataAtom, updateWarehouseDataAtom } from "./atoms.jsx";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import { DateTimePicker, DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessTokenAtom } from "./atoms.jsx";
//import { error } from "console";

// Use FilledForm for elements that will be autopopulated with request information
// As it stands the filled form can only display data and will be updated with buttons
// The buttons will handle accepting, notifications to drivers, docked, completed, etc.
// To use the filled form just pass in request data from whatever page you are using the filled form on.
// The form shuold be as simple to implement as possible, if any code (other than styling) is being done to implement a form then it needs added here.

// The FilledForm will be used to allow CT employees the ability to modify a request
// This form also contains information that is restricted to employees only.
// As well as accept, deny, progress a request through buttons.
// Buttons are made available depending on the state of the request, that state is pulled from the request data.

function Form({ request, closeModal, dateTime }) {
  const queryClient = useQueryClient();
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);
  const [accessToken] = useAtom(accessTokenAtom);
  const path = useLocation().pathname;
  const navigate = useNavigate();

  const nextWorkDay = () => {
    let now = dayjs();
    if (now.day() === 5) {
      // date is Friday
      now = now.add(3, "day");
    } else if (now.day() === 6) {
      // date is Saturday
      now = now.add(2, "day");
    } else {
      now = now.add(1, "day");
    }
    //day now is next work day.
    //set to 8:00 am
    now = now.set("hour", 8).set("minute", 0);
    return now;
  };

  React.useEffect(() => {
    updateWarehouseData();
  }, [updateWarehouseData]);

  const [requestData, setRequestData] = useState({
    id: "",
    approved: false,
    company_name: "",
    phone_number: "",
    email: "",
    warehouse: "",
    po_number: "",
    load_type: "",
    container_drop: false,
    container_number: "",
    notes: "",
    date_time: nextWorkDay(),
    delivery: false,
    trailer_number: null,
    driver_phone_number: null,
    dock_number: null,
    check_in_time: null,
    docked_time: null,
    completed_time: null,
    active: true,
  });

  const load_types = [
    {
      value: "Full",
    },
    {
      value: "LTL",
    },
    {
      value: "Container",
    },
  ];

  React.useEffect(() => {
    if (request) {
      // Convert date_time to dayjs object
      const convertedRequestData = {
        ...request,
        date_time: dayjs(request.date_time),
        check_in_time: request.check_in_time
          ? dayjs(request.check_in_time)
          : null,
        docked_time: request.docked_time ? dayjs(request.docked_time) : null,
        completed_time: request.completed_time
          ? dayjs(request.completed_time)
          : null,
      };
      setRequestData(convertedRequestData);
    }
    if (dateTime) {
      setRequestData({ ...requestData, date_time: dayjs(dateTime) });
    }
  }, [request, dateTime]);

  const [pauseQuery, setPause] = useState(false);
  const [times, setTimes] = useState([]);
  const [selectedDate, setDate] = useState(new dayjs());
  const { key } = React.useMemo(
    () => ({
      key: ["requests", selectedDate],
    }),
    [selectedDate, pauseQuery]
  );

  const findTimes = (date) => {
    console.log("Selected Date: ", date);
    const _date = dayjs(date).format("YYYY-MM-DD");
    console.log("Formatted Date: ", _date);
    setDate(_date);
    setPause(false);
  };

  useQuery({
    queryKey: key,
    queryFn: async () =>
      await axios.get("/api/request/", {
        params: {
          start_date: dayjs(selectedDate).startOf("date").toDate(),
          end_date: dayjs(selectedDate).endOf("date").toDate(),
        },
      }),
    refetchInterval: 300000, // refetches every 300 seconds
    retry: 3,
    enabled: !pauseQuery,
    onSuccess: (data) => {
      const extractHours = data.data.map((entry) => {
        const hours = dayjs(entry.date_time).format("HH:mm");
        return hours;
      });
      console.log(extractHours);
      setTimes(extractHours);
      setPause(true);
    },
    onError: (error) => {
      console.error("Error fetching requests:", error);
      setPause(true);
    },
  });

  const getTimes = (value, view) => {
    const formatted = dayjs(value).format("HH:mm");
    const unavailableTimes = times.includes(formatted);
    const time = dayjs(formatted, "HH:mm");
    let isOutsideWorkingHours =
      time.isBefore(dayjs("08:00", "HH:mm")) ||
      time.isAfter(dayjs("16:00", "HH:mm"));
    if (path != "/RequestForm") isOutsideWorkingHours = false;

    if (isOutsideWorkingHours) return true;
    else if (view === "minutes") return unavailableTimes;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setRequestData({ ...requestData, [name]: newValue });
  };

  const handleButton = (e) => {
    const { name } = e.target;
    console.log("HandleButton Function Call", { name });
    if (name == "dock_number") {
      console.log(document.getElementById("dock_number").value);
      requestData[name] = parseInt(
        document.getElementById("dock_number").value
      );
      requestData["docked_time"] = dayjs().format("YYYY-MM-DD HH:mm:ss");
    } else {
      (requestData[name] = dayjs().format("YYYY-MM-DD HH:mm:ss")),
        name == "completed_time" ? (requestData.active = false) : true;
    }
    updateRequest();
  };

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: dayjs(date),
    });
  };

  const handleApprove = () => {
    requestData.approved = true;
    (requestData.date_time = requestData.date_time.format(
      "YYYY-MM-DD HH:mm:ss"
    )),
      console.log("Approved: ", requestData);
    updateRequest();
  };

  const handleDeny = () => {
    // should we have a deny button?
    requestData.approved = false;
    requestData.date_time = requestData.date_time.format("YYYY-MM-DD HH:mm:ss");
    requestData.active = false;
    updateRequest();
  };

  const handleNewRequest = async () => {
    if (path === "/calendar" || path === "/Calendar") {
      requestData.approved = true;
    }

    try {
      const response = await axios.post("/api/request/", requestData);

      if (path === "/calendar" || path === "/Calendar") {
        queryClient.invalidateQueries("requests");
        closeModal();
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error handling new request:", error);
    }
  };

  const updateRequest = async () => {
    try {
      const response = await axios.put(
        `/api/request/${requestData.id}/`,
        requestData
      );
      console.log("Request Updated........");
      console.log(response);

      queryClient.invalidateQueries("pendingRequests");
      closeModal();
    } catch (error) {
      console.error("Error updating request:", error);
      closeModal();
    }
  };

  // This controls the dyanmic display of buttons based on the state of the request
  let formButton;
  let formBottom;
  let formEnd = (
    <TextField
      required
      label="Driver Phone Number"
      name="driver_phone_number"
      value={requestData.driver_phone_number}
      onChange={handleChange}
    />
  );
  let checkedContent = // Content for checked in appointments
    (
      <Box>
        <DateTimeField
          readOnly
          label="Checked-In Time"
          name="check_in_time"
          value={requestData.check_in_time}
        />

        <TextField
          required
          id="dock_number"
          label="Dock Number"
          name="dock_number"
          value={requestData.dock_number}
          //onChange={}
        />
      </Box>
    );
  let dockedContent = // content for docked appointments
    (
      <Box>
        {" "}
        {checkedContent}
        <DateTimeField
          readOnly
          label="Docked Time"
          name="docked_time"
          value={requestData.docked_time}
        />
      </Box>
    );
  let completionContent; // completed appointments are not displayed
  if (path == "/RequestForm" || !requestData.approved) {
    formButton = (
      <Button variant="contained" onClick={handleNewRequest}>
        Submit
      </Button>
    );
    formBottom = <Box> {formButton} </Box>;
  } else if (
    (path == "/calendar" || path == "/Calendar") &&
    requestData.approved
  ) {
    if (requestData.check_in_time == null) {
      formButton = (
        <Button name="check_in_time" variant="contained" onClick={handleButton}>
          Check-In
        </Button>
      );

      formBottom = (
        <Box>
          {formEnd} {formButton}
        </Box>
      );
    } else if (requestData.dock_number == null) {
      formButton = (
        <Button name="dock_number" variant="contained" onClick={handleButton}>
          Send To Dock
        </Button>
      );

      formBottom = (
        <Box>
          {formEnd} {checkedContent} {formButton}
        </Box>
      );
    } else {
      formButton = (
        <Button
          name="completed_time"
          variant="contained"
          onClick={handleButton}
        >
          Complete
        </Button>
      );
      formBottom = (
        <Box>
          {formEnd} {checkedContent} {dockedContent} {formButton}
        </Box>
      );
    }
  }

  if (path == "/PendingRequests") {
    formBottom = (
      <Stack
        display={"flex"}
        justifyContent={"center"}
        spacing={2}
        direction={"row"}
      >
        <Button color="success" variant="contained" onClick={handleApprove}>
          Approve
        </Button>
        <Button color="error" variant="contained" onClick={handleDeny}>
          Deny
        </Button>
      </Stack>
    );
  }

  return (
    <FormControl>
      <Stack
        spacing={2}
        alignContent={"center"}
        textAlign={"center"}
        display={"flex"}
        margine="normal"
        sx={{
          "& .MuiTextField-root": { m: 1, width: "60ch" },
          "& > :not(style)": { m: 1, width: "60ch" },
          maxHeight: "90vh",
          maxWidth: "60vw",
        }}
      >
        <TextField
          required
          label="Company Name"
          name="company_name"
          value={requestData.company_name}
          onChange={handleChange}
        ></TextField>

        <TextField
          required
          label="Phone Number"
          name="phone_number"
          value={requestData.phone_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          required
          label="Email"
          name="email"
          value={requestData.email}
          onChange={handleChange}
        ></TextField>

        <TextField
          required
          label="Reference Number"
          name="po_number"
          value={requestData.po_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          required
          select
          label="Warehouse"
          name="warehouse"
          variant="filled"
          value={requestData.warehouse}
          onChange={handleChange}
        >
          {warehouseData.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          required
          select
          id="load_type"
          label="Load Type"
          name="load_type"
          variant="filled"
          value={requestData.load_type}
          onChange={handleChange}
        >
          {load_types.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.value}
            </MenuItem>
          ))}
        </TextField>

        {requestData.load_type === "Container" ? (
          <Box>
            <FormControlLabel
              control={<Checkbox />}
              label="Select for Container Drop"
              name="container_drop"
              checked={requestData.container_drop}
              onChange={handleChange}
            />
            <TextField
              label="Container Number"
              name="container_number"
              value={requestData.container_number}
              onChange={handleChange}
            ></TextField>
          </Box>
        ) : null}

        <FormControlLabel
          control={<Checkbox />}
          label="Delivery"
          name="delivery"
          checked={requestData.delivery}
          onChange={handleChange}
        />

        <TextField
          name="notes"
          label="Notes"
          multiline
          rows={4}
          value={requestData.notes}
          onChange={handleChange}
        />

        <DateTimePicker
          ampm={false}
          thresholdToRenderTimeInASingleColumn={30}
          skipDisabled={true}
          label="Select Appointment Date and Time"
          value={dayjs(requestData.date_time)}
          shouldDisableTime={getTimes}
          onChange={findTimes}
          onAccept={(newValue) => handleDateChange(newValue)}
          timeSteps={{ minutes: 15 }}
        />

        {path != "/RequestForm" && (
          <TextField
            label="Trailer Number"
            name="trailer_number"
            value={requestData.trailer_number}
            onChange={handleChange}
          />
        )}

        {formBottom}
      </Stack>
    </FormControl>
  );
}

export default Form;
