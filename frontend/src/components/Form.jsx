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
  FormLabel,
} from "@mui/material";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataEffectAtom} from "./atoms.jsx";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import { DateTimePicker, DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function Form({ request, closeModal, dateTime }) {
  const queryClient = useQueryClient();
  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const path = useLocation().pathname;
  const navigate = useNavigate();

  const [pauseQuery, setPause] = useState(false);
  const [times, setTimes] = useState([]);

  const [getInitialTime, setGetInitialTime] = useState(false);
  React.useEffect(() => {
    refreshWarehouseData();
  }, []);
  // gets work day following provided date
  const nextWorkDay = (date) => {
    // gets the next work day at 8:00 am
    let now = date ? dayjs(date) : dayjs();
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
    now = now.set("hour", 8).set("minute", 0).set("second", 0);
    return now;
  };

  const [selectedDate, setDate] = useState(nextWorkDay());
  const { key } = React.useMemo(
    () => ({
      key: ["requests", selectedDate],
    }),
    [selectedDate, pauseQuery]
  );

  // default request data
  const [requestData, setRequestData] = useState({
    id: "",
    approved: false,
    company_name: "",
    phone_number: "",
    email: "",
    warehouse: "",
    ref_number: "",
    load_type: "",
    container_drop: false,
    container_number: "",
    notes: "",
    date_time: nextWorkDay(),
    delivery: "",
    trailer_number: "",
    driver_phone_number: null,
    sms_consent: false,
    dock_number: null,
    check_in_time: null,
    docked_time: null,
    completed_time: null,
    active: true,
  });

  // fields required for form completion
  const requiredFields = React.useMemo(() => {
    let fields = [
      "company_name",
      "phone_number",
      "email",
      "warehouse",
      "ref_number",
      "load_type",
      "delivery",
      // "trailer_number",
    ];
    return fields;
  }, [path]);

  // Form Completion:
  const [requiredFieldsCompleted, setRequiredFieldsCompleted] = useState(
    requiredFields.reduce((acc, field) => {
      acc[field] = false;
      return acc;
    }, {})
  );
  const isFormCompleted = () => {
    return Object.values(requiredFieldsCompleted).every(
      (completed) => completed
    );
  };
  const submitButtonDisabled = !isFormCompleted();

  // Load type selections
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

  React.useMemo(() => {
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
  }, []);

  // update times based on selected date
  const findTimes = (date) => {
    const _date = dayjs(date).format("YYYY-MM-DD");
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
      const extractTimes = data.data.map((entry) => {
        return {
          time: dayjs(entry.date_time).format("HH:mm"),
          warehouse: entry.warehouse,
        };
      });
      setTimes(extractTimes);
      setPause(true);
    },
    onError: (error) => {
      console.error("Error fetching requests:", error);
      setPause(true);
    },
  });

  // find times to be disabled
  const getTimes = (value, view) => {
    // return true will disable the time
    const formattedTime = dayjs(value).format("HH:mm");

    const timesForSelectedWarehouse = times.filter(
      (entry) => entry.warehouse === requestData.warehouse
    );
    const timeUnavailable = timesForSelectedWarehouse.some(
      (entry) => entry.time === formattedTime
    );
    const time = dayjs(formattedTime, "HH:mm");
    let isOutsideWorkingHours =
      time.isBefore(dayjs("08:00", "HH:mm")) ||
      time.isAfter(dayjs("16:00", "HH:mm"));
    if (path != "/RequestForm") isOutsideWorkingHours = false;

    if (isOutsideWorkingHours) return true;
    else if (view === "minutes") {
      return timeUnavailable;
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === "delivery") {
      setRequestData({ ...requestData, [name]: value === "delivery" });
    } else if (type === "checkbox") {
      setRequestData({ ...requestData, [name]: checked });
    } else if (name === "container_number") {
      setRequestData({
        ...requestData,
        [name]: value,
        ref_number: value,
        trailer_number: value,
      });
      setRequiredFieldsCompleted((prevCompleted) => ({
        ...prevCompleted,
        ref_number: !!value,
        trailer_number: !!value,
      }));
    } else if (
      name === "load_type" &&
      value != "Container" &&
      (requestData.container_drop || requestData.container_number)
    ) {
      // if the value of load type is not container, but the container drop is true or container number is not empty,
      // reset the container drop, container number, ref number, trailer number
      setRequestData({
        ...requestData,
        [name]: value,
        container_drop: false,
        container_number: "",
        trailer_number: "",
        ref_number: "",
      });
      setRequiredFieldsCompleted((prevCompleted) => ({
        // reset required fields that we erased.
        ...prevCompleted,
        trailer_number: false,
        ref_number: false,
      }));
    } else setRequestData({ ...requestData, [name]: value });

    if (requiredFields.includes(name)) {
      if (type === "checkbox")
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: true,
        }));
      else if (name === "container_number")
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          ref_number: !!value,
          trailer_number: !!value,
          [name]: !!value,
        }));
      else
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: !!value,
        }));
    }
    if (name === "warehouse" && path === "/RequestForm") {
      setGetInitialTime(true);
    }
  };

  const handleButton = (e) => {
    const { name } = e.target;
    if (name == "dock_number") {
      if (!requestData.sms_consent) {
        window.alert(
          "Driver did not consent to SMS notifications.\nPlease inform them of dock number."
        );
      }
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
      updateRequest();
  };

  const handleNewRequest = async () => {
    if (path === "/Calendar") {
      requestData.approved = true;
    }

    try {
      const response = await axios.post("/api/request/", requestData);

      if (path === "/Calendar") {
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
      queryClient.invalidateQueries("pendingRequests");
      closeModal();
    } catch (error) {
      console.error("Error updating request:", error);
      closeModal();
    }
  };

  // gets the first available time following
  const getFirstAvailableTime = (date) => {
    if (!getInitialTime) return;
    let beginNextDay = nextWorkDay();
    findTimes(beginNextDay);
    while (true) {
      if (!getTimes(beginNextDay, "minutes")) break;
      beginNextDay = beginNextDay.add(15, "minutes");
      if (beginNextDay.hour() === 16) {
        beginNextDay = nextWorkDay(beginNextDay);
      }
    }
    handleDateChange(beginNextDay);
  };

  React.useMemo(() => {
    if (getInitialTime) getFirstAvailableTime();
    setGetInitialTime(false);
  }, [getInitialTime]);

  // This controls the dyanmic display of buttons based on the state of the request
  let formButton;
  let formBottom;
  let formEnd = (
    <Box>
      <TextField
        required
        label="Driver Phone Number"
        name="driver_phone_number"
        value={requestData.driver_phone_number}
        onChange={handleChange}
        InputProps={{
          readOnly: requestData.check_in_time != null ? true : false,
        }}
      />
      <Typography>
        Read to Driver: Do you consent to receive recurring appointment updates
        via SMS from Candor Logistics? Msg and data rates may apply.
      </Typography>
      <FormControlLabel
        required
        control={<Checkbox />}
        label="SMS Consent"
        name="sms_consent"
        checked={requestData.sms_consent}
        onChange={handleChange}
      />
    </Box>
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
          InputProps={{
            readOnly: requestData.dock_number != null ? true : false,
          }}
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
      <Button
        variant="contained"
        onClick={handleNewRequest}
        disabled={submitButtonDisabled}
      >
        Submit
      </Button>
    );
    formBottom = <Box> {formButton} </Box>;
  } else if (path == "/Calendar" && requestData.approved) {
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
          {formEnd} {dockedContent} {formButton}
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
      </Stack>
    );
  }

  return (
    <Box marginBottom={"20px"}>
      <FormControl>
        <Stack
          spacing={2}
          alignContent={"center"}
          textAlign={"center"}
          margine="normal"
          sx={{
            "& .MuiTextField-root": { m: 1, width: "60ch" },
            "& > :not(style)": { m: 1, width: "60ch" },
            maxWidth: "70vw",
          }}
        >
          <TextField
            required
            label="Company Name"
            name="company_name"
            value={requestData.company_name}
            onChange={handleChange}
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
          ></TextField>

          <TextField
            required
            label="Phone Number"
            name="phone_number"
            value={requestData.phone_number}
            onChange={handleChange}
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
          ></TextField>

          <TextField
            required
            label="Email"
            name="email"
            value={requestData.email}
            onChange={handleChange}
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
          ></TextField>

          <TextField
            required
            label="Reference Number"
            name="ref_number"
            value={requestData.ref_number}
            onChange={handleChange}
            InputProps={{
              readOnly:
                (request && path != "/PendingRequests") ||
                requestData.load_type == "Container"
                  ? true
                  : false,
            }}
          ></TextField>

          <TextField
            required
            select
            label="Warehouse"
            name="warehouse"
            variant="filled"
            value={requestData.warehouse}
            onChange={handleChange}
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
          >
            {warehouseData.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {path === "/RequestForm" ? option.address : option.name}
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
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
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
                label="Intermodal Container Number"
                name="container_number"
                value={requestData.container_number}
                onChange={handleChange}
              />
            </Box>
          ) : null}
          <TextField
            required
            select
            id="delivery"
            label="Select Pickup or Delivery"
            name="delivery"
            variant="filled"
            value={
              requestData.delivery === ""
                ? ""
                : requestData.delivery
                ? "delivery"
                : "pickup"
            }
            onChange={handleChange}
            InputProps={{
              readOnly: request && path != "/PendingRequests" ? true : false,
            }}
          >
            <MenuItem key={"delivery"} value={"delivery"}>
              Delivery
            </MenuItem>
            <MenuItem key={"pickup"} value={"pickup"}>
              Pickup
            </MenuItem>
          </TextField>

          {requestData.load_type !== "Container" && (
            <TextField
              // required
              label="Trailer Number"
              name="trailer_number"
              value={requestData.trailer_number}
              onChange={handleChange}
            />
          )}

          <TextField
            name="notes"
            label="Notes"
            multiline
            rows={4}
            value={requestData.notes}
            onChange={handleChange}
          />
          {requestData.warehouse === "" ? (
            <Typography maxWidth={480} color="error">
              Please select a warehouse
            </Typography>
          ) : request && path != "/PendingRequests" ? (
            <DateTimeField
              readOnly
              label="Appointment Date and Time"
              name="date_time"
              value={requestData.date_time}
            />
          ) : (
            <DateTimePicker
              disabled={requestData.warehouse === ""}
              ampm={false}
              thresholdToRenderTimeInASingleColumn={30}
              skipDisabled={true}
              label="Select Appointment Date and Time"
              value={requestData.date_time}
              shouldDisableTime={getTimes}
              onChange={(date) => {
                findTimes(date);
              }}
              onAccept={(newValue) => handleDateChange(newValue)}
              timeSteps={{ minutes: 15 }}
            />
          )}

          {formBottom}
        </Stack>
      </FormControl>
    </Box>
  );
}

export default Form;
