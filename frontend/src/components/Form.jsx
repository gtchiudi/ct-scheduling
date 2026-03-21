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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  Alert,
  Collapse,
} from "@mui/material";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataEffectAtom, editAppointmentAtom } from "./atoms.jsx";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import { DateTimePicker, DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Calendar from "../routes/Calendar.jsx";
import { IMaskInput } from 'react-imask';
import PropTypes from 'prop-types';

const PhoneMaskCustom = React.forwardRef(function PhoneMaskCustom(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="(000)-000-0000"
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

PhoneMaskCustom.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function Form({ request, closeModal, dateTime, onLockChange }) {
  const queryClient = useQueryClient();
  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [editAppointment, setEditAppointment] = useAtom(editAppointmentAtom);
  const path = useLocation().pathname;
  const navigate = useNavigate();

  const [pauseQuery, setPause] = useState(false);
  const [times, setTimes] = useState([]);

  const [getInitialTime, setGetInitialTime] = useState(false);
  
  // Add validation state
  const [emailError, setEmailError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [driverPhoneError, setDriverPhoneError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [formAlert, setFormAlert] = useState(null); // { message, severity, onAcknowledge? }

  React.useEffect(() => {
    onLockChange?.(formAlert?.onAcknowledge || null);
  }, [formAlert]);

  React.useEffect(() => {
    refreshWarehouseData();
  }, []);

  // gets work day following provided date, optionally in a given IANA timezone
  const nextWorkDay = (date, tz) => {
    let now = tz
      ? (date ? dayjs(date).tz(tz) : dayjs().tz(tz))
      : (date ? dayjs(date) : dayjs());
    if (now.day() === 5) {
      now = now.add(3, "day");
    } else if (now.day() === 6) {
      now = now.add(2, "day");
    } else {
      now = now.add(1, "day");
    }
    return now.set("hour", 8).set("minute", 0).set("second", 0);
  };

  const [selectedDate, setDate] = useState(nextWorkDay());
  const { key } = React.useMemo(
    () => ({
      key: ["requests", selectedDate],
    }),
    [selectedDate, pauseQuery]
  );

  // default request data
  const initialRequestData = {
    id: "",
    approved: false,
    company_name: "",
    customer_name: null,
    phone_number: "",
    email: "",
    warehouse: "",
    ref_number: "",
    load_type: "",
    container_drop: false,
    container_number: "",
    note_section: "",
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
  };
  const [requestData, setRequestData] = useState(initialRequestData);

  React.useEffect(() => {
    if (!request && requestData.warehouse === "") {
      setFormAlert({ message: "Please select a warehouse to view appointment times.", severity: "info" });
    } else if (requestData.warehouse !== "") {
      setFormAlert((prev) => prev?.message === "Please select a warehouse." ? null : prev);
    }
  }, [requestData.warehouse]);

  // fields required for form completion
  const requiredFields = React.useMemo(() => {
    let fields = [
      "company_name",
      "warehouse",
      "ref_number",
      "load_type",
      "delivery",
    ];
    if (path === "/RequestForm") {
      fields = [...fields, "phone_number", "email"];
    }
    if (path === "/PendingRequests" || path === "/Calendar") {
      fields = [...fields, "customer_name"];
    }
    if (requestData.load_type === "Container") {
      fields = [...fields, "container_number"];
    }
    return fields;
  }, [path, requestData.load_type]);

  // Form Completion:
  const [requiredFieldsCompleted, setRequiredFieldsCompleted] = useState(
    requiredFields.reduce((acc, field) => {
      acc[field] = false;
      return acc;
    }, {})
  );
  const isFormCompleted = () => {
    const allFieldsCompleted = requiredFields.every((field) => requiredFieldsCompleted[field]);
    const noValidationErrors = !emailError && !phoneError && !driverPhoneError && !timeError;
    return allFieldsCompleted && noValidationErrors;
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
      setRequiredFieldsCompleted((prev) => {
        const updated = { ...prev };
        requiredFields.forEach((field) => {
          updated[field] = !!convertedRequestData[field];
        });
        return updated;
      });
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
  const getTimesToDisable = (value, view) => {
    // return true will disable the time
    const formattedTime = dayjs(value).format("HH:mm");

    const timesForSelectedWarehouse = times.filter(
      (entry) => entry.warehouse === requestData.warehouse
    );
    const appointmentsAtSlot = timesForSelectedWarehouse.filter(
      (entry) => entry.time === formattedTime
    ).length;
    const warehouse = warehouseData.find((w) => w.id === requestData.warehouse);
    const appointmentsPerSlot = warehouse?.appointments_per_slot ?? 1;
    const timeUnavailable = appointmentsAtSlot >= appointmentsPerSlot;

    const time = dayjs(formattedTime, "HH:mm");
    let isOutsideWorkingHours =
      time.isBefore(dayjs("08:00", "HH:mm")) ||
      time.isAfter(dayjs("16:00", "HH:mm"));
    if (path != "/RequestForm") isOutsideWorkingHours = false;

    if (path !== "/RequestForm") return false;
    if (isOutsideWorkingHours) return true;
    else if (view === "minutes") {
      return timeUnavailable;
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    
    // Remove formatting from phone numbers before saving
    let processedValue = value;
    if (name === "phone_number" || name === "driver_phone_number") {
      processedValue = value.replace(/\D/g, ''); // Remove all non-digits
      
      // Validate phone number
      const isValid = validatePhone(value);
      if (name === "phone_number") {
        setPhoneError(!isValid);
      } else if (name === "driver_phone_number") {
        setDriverPhoneError(!isValid);
      }
    }
    
    // Validate email
    if (name === "email") {
      const isValidEmail = validateEmail(value);
      setEmailError(!isValidEmail);
    }
    
    if (name === "delivery") {
      setRequestData({ ...requestData, [name]: processedValue === "delivery" });
    } else if (type === "checkbox") {
      setRequestData({ ...requestData, [name]: checked });
    } else if (name === "container_number") {
      setRequestData({
        ...requestData,
        [name]: processedValue,
        ref_number: processedValue,
        trailer_number: processedValue,
      });
      setRequiredFieldsCompleted((prevCompleted) => ({
        ...prevCompleted,
        ref_number: !!processedValue,
        trailer_number: !!processedValue,
      }));
    } else if (
      name === "load_type" &&
      processedValue != "Container" &&
      (requestData.container_drop || requestData.container_number)
    ) {
      // if the value of load type is not container, but the container drop is true or container number is not empty,
      // reset the container drop, container number, ref number, trailer number
      setRequestData({
        ...requestData,
        [name]: processedValue,
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
    } else setRequestData({ ...requestData, [name]: processedValue });

    if (requiredFields.includes(name)) {
      if (type === "checkbox")
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: true,
        }));
      else if (name === "container_number")
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          ref_number: !!processedValue,
          trailer_number: !!processedValue,
          [name]: !!processedValue,
        }));
      else
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: !!processedValue,
        }));
    }
    if (name === "warehouse" && path === "/RequestForm") {
      setGetInitialTime(true);
    }
  };

  const handleButton = (e) => {
    const { name } = e.target;
    if (name == "dock_number") {
      const dockNum = parseInt(document.getElementById("dock_number").value);
      const dockedTime = dayjs().format("YYYY-MM-DD HH:mm:ss");
      if (!requestData.sms_consent) {
        setFormAlert({
          message: "Driver did not consent to SMS notifications. Please inform them of dock number.",
          severity: "warning",
          onAcknowledge: () => {
            requestData.dock_number = dockNum;
            requestData.docked_time = dockedTime;
            updateRequest();
          },
        });
        return;
      }
      requestData[name] = dockNum;
      requestData["docked_time"] = dockedTime;
    } else if (name == "check_in_time") {
      requestData[name] = dayjs().format("YYYY-MM-DD HH:mm:ss");
    } else if (name == 'completed_time'){
      requestData[name] = dayjs().format("YYYY-MM-DD HH:mm:ss");
    } else if (name == 'remove_from_calendar') {
      requestData.active = false;
    }
    updateRequest();
  };

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: dayjs(date),
    });
  };

  const getWarningProps = (fieldName, { hasError = false, filled = false } = {}) => {
    if (hasError || !requiredFields.includes(fieldName) || requiredFieldsCompleted[fieldName]) return {};
    if (filled) {
      return {
        sx: {
          "& .MuiFilledInput-root:before": { borderBottomColor: "#ed6c02" },
          "& .MuiFilledInput-root:after": { borderBottomColor: "#ed6c02" },
          "& .MuiFilledInput-root:hover:before": { borderBottomColor: "#e65100" },
          "& label": { color: "#ed6c02" },
        },
      };
    }
    return {
      sx: {
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#ed6c02" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#e65100" },
        "& .MuiInputLabel-root": { color: "#ed6c02" },
        "& .MuiInputLabel-root.Mui-focused": { color: "#ed6c02" },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#ed6c02" },
      },
    };
  };

  const handleApprove = () => {
    requestData.approved = true;
    (requestData.date_time = requestData.date_time.format(
      "YYYY-MM-DD HH:mm:ss"
    )),
      updateRequest();
  };

  const handleDialogueClose = () => {
    setSuccessOpen(false);
    setRequestData(initialRequestData);
    setRequiredFieldsCompleted(requiredFields.reduce((acc, field) => { acc[field] = false; return acc; }, {}));
    setEmailError(false);
    setPhoneError(false);
    setDriverPhoneError(false);
    setTimeError(false);
    setFormAlert(null);
  }

  const handleNewRequest = async () => {
    if (path === "/Calendar") {
      requestData.approved = true;
    }

    try {
      const response = await axios.post("/api/request/", requestData);

      if (path === "/Calendar") {
        queryClient.invalidateQueries(["requests"]);
        closeModal();
      } else {
        setSuccessOpen(true);
      }
    } catch (error) {
      console.error("Error handling new request:", error);
      
      // Handle validation errors from backend
      if (error.response && error.response.data) {
        const errors = error.response.data;
        
        if (errors.email) {
          setEmailError(true);
          setFormAlert({ message: `Email Error: ${errors.email.join(', ')}`, severity: "error" });
        }
        if (errors.phone_number) {
          setPhoneError(true);
          setFormAlert({ message: `Phone Error: ${errors.phone_number.join(', ')}`, severity: "error" });
        }
      }
    }
  };

  const updateRequest = async () => {
    try {
      const response = await axios.put(
        `/api/request/${requestData.id}/`,
        requestData
      );
      queryClient.invalidateQueries(["pendingRequests"]);
      queryClient.invalidateQueries(["requests"]);
      setEditAppointment(false);
      closeModal();
    } catch (error) {
      console.error("Error updating request:", error);
      
      // Handle validation errors from backend
      if (error.response && error.response.data) {
        const errors = error.response.data;
        
        if (errors.email) {
          setEmailError(true);
          setFormAlert({ message: `Email Error: ${errors.email.join(', ')}`, severity: "error" });
        }
        if (errors.phone_number) {
          setPhoneError(true);
          setFormAlert({ message: `Phone Error: ${errors.phone_number.join(', ')}`, severity: "error" });
        }
      }

      setEditAppointment(false);
      closeModal();
    }
  };

  const warehouseTimezone = React.useMemo(() => {
    const wh = warehouseData.find((w) => w.id === requestData.warehouse);
    return wh?.timezone || null;
  }, [warehouseData, requestData.warehouse]);

  // gets the first available time following
  const getFirstAvailableTime = () => {
    if (!getInitialTime) return;
    let beginNextDay = nextWorkDay(null, warehouseTimezone);
    findTimes(beginNextDay);
    while (true) {
      if (!getTimesToDisable(beginNextDay, "minutes")) break;
      beginNextDay = beginNextDay.add(15, "minutes");
      if (beginNextDay.hour() === 16) {
        beginNextDay = nextWorkDay(beginNextDay, warehouseTimezone);
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
        label="Driver Phone Number"
        name="driver_phone_number"
        value={requestData.driver_phone_number ?? ""}
        onChange={handleChange}
        autoComplete="off"
        error={driverPhoneError}
        helperText={driverPhoneError ? "Phone number must be 10 digits" : ""}
        InputProps={{
          readOnly: requestData.check_in_time != null ? true : false,
          inputComponent: PhoneMaskCustom,
        }}
      />
      <Typography>
        Read to Driver: Do you consent to receive recurring appointment updates
        via SMS from Candor Logistics? Msg and data rates may apply.
      </Typography>
      <FormControlLabel
        control={<Checkbox />}
        label="SMS Consent"
        name="sms_consent"
        checked={requestData.sms_consent}
        onChange={handleChange}
      />
    </Box>
  );
  let checkedInContent = // Content for checked in appointments
    (
      <Box>
        <DateTimeField
          readOnly
          label="Checked-In Time"
          name="check_in_time"
          value={requestData.check_in_time ? dayjs(requestData.check_in_time) : undefined}
        />

        <TextField
          required
          id="dock_number"
          label="Dock Number"
          name="dock_number"
          defaultValue={requestData.dock_number ?? ""}
          autoComplete="off"
          InputProps={{
            readOnly: requestData.dock_number != null ? true : false,
          }}
        />
      </Box>
    );
  let dockedContent = // content for docked appointments
    (
      <Box>
        {" "}
        {checkedInContent}
        <DateTimeField
          readOnly
          label="Docked Time"
          name="docked_time"
          value={requestData.docked_time ? dayjs(requestData.docked_time) : undefined}
        />
      </Box>
    );
  let completionContent = // completed will have button to remove from calendar.
    (
      <Box>
        {" "}
        {dockedContent}
        <DateTimeField
          readOnly
          label="Completed Time"
          name="completed_time"
          value={requestData.completed_time ? dayjs(requestData.completed_time) : undefined}
        />
      </Box>
    );

  if (path == "/RequestForm" || !requestData.approved) {
    formButton = (
      <Button
        name = 'submit'
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
      if (editAppointment) {
        const cancelButton = (
          <Button
            variant="contained"
            color="error"
            onClick={() => setCancelConfirmOpen(true)}
          >
            Cancel Appointment
          </Button>
        );
        formButton = (
          <Button 
            variant="contained"
            color="success"
            onClick={updateRequest}
            disabled={submitButtonDisabled}
          >
            Save Changes
          </Button>
        );
        formBottom = (
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
            {cancelButton}
            {formButton}
          </Box>
        );
      } else {
        const isDriverPhoneValid = !driverPhoneError && (
          !requestData.driver_phone_number || 
          requestData.driver_phone_number.replace(/\D/g, '').length === 10
        );
        
        formButton = (
          <Button
            name="check_in_time"
            variant="contained"
            onClick={handleButton}
            disabled={!isDriverPhoneValid}
          >
            Check-In
          </Button>
        );
        formBottom = (
          <Box>
            {formEnd} {formButton}
          </Box>
        );
      }

    } else if (requestData.dock_number == null) {
      formButton = (
        <Button name="dock_number" variant="contained" onClick={handleButton} disabled={!!formAlert?.onAcknowledge}>
          Send To Dock
        </Button>
      );

      formBottom = (
        <Box>
          {formEnd} {checkedInContent} {formButton}
        </Box>
      );
    } else if (requestData.completed_time == null){
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
    } else {
      formButton = (
        <Button
          name="remove_from_calendar"
          variant="contained"
          onClick={handleButton}
        >
          Remove from Calendar
        </Button>
      );
      formBottom = (
        <Box>
          {formEnd} {completionContent} {formButton}
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
        <Button color="success" variant="contained" onClick={handleApprove} disabled={submitButtonDisabled}>
          Approve
        </Button>
      </Stack>
    );
  }

  return (
    <Box>
      <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}>
        <DialogTitle textAlign="center">Cancel Appointment</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Are you sure you want to cancel this appointment?
          </Typography>
        </DialogContent>
        <DialogActions
          justifyContent="center"
        >
          <MuiButton 
            onClick={() => setCancelConfirmOpen(false)}
            variant="contained"
          >
            Go Back
          </MuiButton>
          <MuiButton
            autoFocus
            variant="contained"
            color="error"
            onClick={() => {
              setCancelConfirmOpen(false);
              requestData.cancelled_time = dayjs().format("YYYY-MM-DD HH:mm:ss");
              updateRequest();
            }}
          >
            Cancel Appointment
          </MuiButton>
        </DialogActions>
      </Dialog>

      <Dialog open={successOpen} onClose={handleDialogueClose}>
        <DialogTitle textAlign="center">Request Submitted</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Your appointment request has been submitted successfully.
            <br/>
            Please check your inbox for a confirmation email.
          </Typography>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={handleDialogueClose}>Submit Another</MuiButton>
          <MuiButton variant="contained" onClick={() => navigate("/")}>Dismiss</MuiButton>
        </DialogActions>
      </Dialog>
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
            required={requiredFields.includes("company_name")}
            label="Company Name"
            name="company_name"
            value={requestData.company_name}
            onChange={handleChange}
            autoComplete="off"
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
            }}
            {...getWarningProps("company_name")}
          ></TextField>

          <TextField
            required={requiredFields.includes("phone_number")}
            label="Phone Number"
            name="phone_number"
            value={requestData.phone_number}
            onChange={handleChange}
            autoComplete="off"
            error={phoneError}
            helperText={phoneError ? "Phone number must be 10 digits" : ""}
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
              inputComponent: PhoneMaskCustom,
            }}
            {...getWarningProps("phone_number", { hasError: phoneError })}
          ></TextField>

          <TextField
            required={requiredFields.includes("email")}
            label="Email"
            name="email"
            value={requestData.email}
            onChange={handleChange}
            autoComplete="off"
            error={emailError}
            helperText={emailError ? "Please enter a valid email address" : ""}
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
            }}
            {...getWarningProps("email", { hasError: emailError })}
          ></TextField>

          <TextField
            required={requiredFields.includes("ref_number")}
            label="Reference Number"
            name="ref_number"
            value={requestData.ref_number}
            onChange={handleChange}
            autoComplete="off"
            InputProps={{
              readOnly:
                (request && path != "/PendingRequests") ||
                requestData.load_type == "Container" ||
                editAppointment
                  ? true
                  : false,
            }}
            {...getWarningProps("ref_number")}
          ></TextField>

          {path !== "/RequestForm" && (
            <TextField
              required={requiredFields.includes("customer_name")}
              label="Customer Name"
              name="customer_name"
              value={requestData.customer_name ?? null}
              onChange={handleChange}
              autoComplete="off"
              InputProps={{
                readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
              }}
              {...getWarningProps("customer_name")}
            />
          )}

          <TextField
            required={requiredFields.includes("warehouse")}
            select
            label="Warehouse"
            name="warehouse"
            variant="filled"
            value={requestData.warehouse}
            onChange={handleChange}
            autoComplete="off"
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
            }}
            {...getWarningProps("warehouse", { filled: true })}
          >
            {warehouseData.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {path === "/RequestForm" ? option.address : option.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            required={requiredFields.includes("load_type")}
            select
            id="load_type"
            label="Load Type"
            name="load_type"
            variant="filled"
            value={requestData.load_type}
            onChange={handleChange}
            autoComplete="off"
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
            }}
            {...getWarningProps("load_type", { filled: true })}
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
                required={requiredFields.includes("container_number")}
                label="Intermodal Container Number"
                name="container_number"
                value={requestData.container_number}
                onChange={handleChange}
                autoComplete="off"
                {...getWarningProps("container_number")}
              />
            </Box>
          ) : null}
          <TextField
            required={requiredFields.includes("delivery")}
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
            autoComplete="off"
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
            }}
            {...getWarningProps("delivery", { filled: true })}
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
              autoComplete="off"
            />
          )}

          <TextField
            name="note_section"
            label="Notes"
            multiline
            rows={4}
            value={requestData.note_section}
            onChange={handleChange}
            autoComplete="off"
            InputProps={{
              readOnly: request && path != "/PendingRequests" && !editAppointment ? true : false,
              sx: { whiteSpace: "pre-wrap" },
            }}
          />
          {requestData.warehouse === "" ? null : request && path != "/PendingRequests" && !editAppointment ? (
            <DateTimeField
              readOnly
              label="Appointment Date and Time"
              name="date_time"
              value={dayjs(requestData.date_time)}
            />
          ) : (
            <>
              <DateTimePicker
                disabled={requestData.warehouse === ""}
                ampm={false}
                thresholdToRenderTimeInASingleColumn={30}
                skipDisabled={true}
                label="Select Appointment Date and Time"
                value={dayjs(requestData.date_time)}
                shouldDisableTime={(path == "/RequestForm") ? getTimesToDisable : null}
                onChange={(date) => {
                  findTimes(date);
                  if (date && dayjs(date).isValid()) {
                    const prevMinutes = dayjs(requestData.date_time).minute();
                    const newMinutes = dayjs(date).minute();
                    const minuteDelta = Math.abs(newMinutes - prevMinutes);
                    // Only snap during arrow key presses (delta of 1 or 59 for wrap-around)
                    const isArrowKey = minuteDelta === 1 || minuteDelta === 59;

                    let snappedDate = dayjs(date).second(0);

                    if (newMinutes !== prevMinutes && isArrowKey) {
                      // isDownWrap: 0→59 — MUI does not decrement hour, so we must
                      const isDownWrap = newMinutes > prevMinutes && newMinutes - prevMinutes > 30;
                      const isUpWrap   = prevMinutes > newMinutes && prevMinutes - newMinutes > 30;
                      const wentUp = (newMinutes > prevMinutes && !isDownWrap) || isUpWrap;

                      if (wentUp) {
                        const snapped = Math.ceil(newMinutes / 15) * 15;
                        snappedDate = snapped === 60
                          ? dayjs(date).add(1, "hour").minute(0).second(0)
                          : dayjs(date).minute(snapped).second(0);
                      } else {
                        const snapped = Math.floor(newMinutes / 15) * 15;
                        snappedDate = isDownWrap
                          ? dayjs(date).subtract(1, "hour").minute(snapped).second(0)
                          : dayjs(date).minute(snapped).second(0);
                      }
                    }

                    handleDateChange(snappedDate);
                    if (path === "/RequestForm") {
                      const notAligned = dayjs(snappedDate).minute() % 15 !== 0;
                      setTimeError(notAligned || !!getTimesToDisable(snappedDate, "minutes"));
                    }
                  }
                }}
                timeSteps={{ minutes: 15 }}
                disablePast={path === "/RequestForm"}
                shouldDisableDate={(date) => (dayjs(date).isSame(dayjs(), "day") && path == "/RequestForm")}
                timezone={warehouseTimezone || undefined}
                slotProps={{
                  textField: {
                    error: timeError,
                    helperText: timeError
                      ? "Please select an available time in 15-minute increments."
                      : warehouseTimezone ? `Timezone: ${warehouseTimezone}` : "",
                    onBlur: () => {
                      const current = dayjs(requestData.date_time);
                      const minutes = current.minute();
                      if (minutes % 15 !== 0) {
                        const snapped = Math.round(minutes / 15) * 15;
                        const snappedDate = snapped === 60
                          ? current.add(1, "hour").minute(0).second(0)
                          : current.minute(snapped).second(0);
                        handleDateChange(snappedDate);
                        if (path === "/RequestForm") {
                          setTimeError(!!getTimesToDisable(snappedDate, "minutes"));
                        }
                      }
                    },
                  },
                }}
              />
            </>
          )}

          <Box>
            <Collapse in={!!formAlert}>
              {formAlert && (
                <Alert
                  severity={formAlert.severity}
                  onClose={formAlert.onAcknowledge ? undefined : () => setFormAlert(null)}
                  action={
                    formAlert.onAcknowledge ? (
                      <MuiButton size="small" color="inherit" onClick={() => { setFormAlert(null); formAlert.onAcknowledge(); }}>
                        OK
                      </MuiButton>
                    ) : undefined
                  }
                >
                  <Box textAlign="center">{formAlert.message}</Box>
                </Alert>
              )}
            </Collapse>
          </Box>
          {formBottom}
        </Stack>
      </FormControl>
    </Box>
    </Box>
  );
}

export default Form;

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 0 || digitsOnly.length === 10;
};
