import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TextField from "@mui/material/TextField";
import {
  Autocomplete,
  Checkbox,
  Box,
  FormControl,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  Alert,
  Typography,
  Stack,
  IconButton,
  InputAdornment,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import { styled, lighten, darken } from "@mui/system";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataEffectAtom, editAppointmentAtom, customerDataEffectAtom } from "./atoms.jsx";
import FormControlLabel from "@mui/material/FormControlLabel";

const GroupHeader = styled('div')(({ theme }) => ({
  position: 'sticky',
  top: '-8px',
  padding: '4px 10px',
  color: theme.palette.primary.main,
  backgroundColor: lighten(theme.palette.primary.light, 0.85),
  ...theme.applyStyles?.('dark', {
    backgroundColor: darken(theme.palette.primary.main, 0.8),
  }),
}));

const GroupItems = styled('ul')({
  padding: 0,
});
import { DateTimePicker, DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PhoneMaskCustom from "./PhoneMaskCustom.jsx";
import FormActions from "./FormActions.jsx";
import { validateEmail, validatePhone } from "../utils/validation.js";

const ADD_CUSTOMER_OPTION = { id: '__add__', customer_name: '+ Add New Customer', email_address: '', send_email_updates: false };

function Form({ request, closeModal, dateTime, onLockChange }) {
  const queryClient = useQueryClient();
  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [customerData, refreshCustomerData] = useAtom(customerDataEffectAtom);
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
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false);
  const [formAlert, setFormAlert] = useState(null); // { message, severity, onAcknowledge? }
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ customer_name: '', email_address: '', send_email_updates: false });
  const [newCustomerEmailError, setNewCustomerEmailError] = useState(false);
  const [editingCustomerEmail, setEditingCustomerEmail] = useState(false);
  const [customerEmailDraft, setCustomerEmailDraft] = useState("");

  React.useEffect(() => {
    onLockChange?.(formAlert?.onAcknowledge || null);
  }, [formAlert]);

  React.useEffect(() => {
    refreshWarehouseData();
    refreshCustomerData();
  }, []);

  // Once customerData loads, re-anchor requestData.customer to the matching object
  // from the options list so the Autocomplete can find it.
  React.useEffect(() => {
    if (!customerData.length) return;
    setRequestData((prev) => {
      if (!prev.customer) return prev;
      const match = customerData.find((c) => c.id === prev.customer.id);
      if (!match || match === prev.customer) return prev;
      return { ...prev, customer: match };
    });
  }, [customerData]);

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
    customer: null,
    send_email_updates: false,
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
      setFormAlert((prev) => prev?.message === "Please select a warehouse to view appointment times." ? null : prev);
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
        check_in_time: request.check_in_time ? dayjs(request.check_in_time) : null,
        docked_time: request.docked_time ? dayjs(request.docked_time) : null,
        completed_time: request.completed_time ? dayjs(request.completed_time) : null,
        send_email_updates: request.customer?.send_email_updates ?? false,
      };
      setRequestData(convertedRequestData);
      setRequiredFieldsCompleted((prev) => {
        // Compute fields based on the loaded data, not the current requiredFields,
        // since load_type-dependent fields (e.g. container_number) aren't in
        // requiredFields yet when this seeding runs.
        const fieldsToSeed = ["company_name", "warehouse", "ref_number", "load_type", "delivery"];
        if (path === "/RequestForm") fieldsToSeed.push("phone_number", "email");
        if (path === "/PendingRequests" || path === "/Calendar") fieldsToSeed.push("customer_name", "customer");
        if (convertedRequestData.load_type === "Container") fieldsToSeed.push("container_number");

        const updated = { ...prev };
        fieldsToSeed.forEach((field) => {
          updated[field] = convertedRequestData[field] !== null &&
            convertedRequestData[field] !== undefined &&
            convertedRequestData[field] !== "";
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
    enabled: !pauseQuery && path === "/RequestForm",
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

  const handleCustomerChange = (event, newValue) => {
    if (newValue?.id === '__add__') {
      setAddCustomerOpen(true);
      return;
    }
    const customer = newValue || null;
    setRequestData((prev) => ({
      ...prev,
      customer,
      customer_name: customer ? customer.customer_name : null,
      send_email_updates: customer ? customer.send_email_updates : false,
    }));
    setRequiredFieldsCompleted((prev) => ({
      ...prev,
      customer_name: !!customer,
    }));
    setEditingCustomerEmail(false);
    setCustomerEmailDraft("");
  };

  const handleCreateCustomer = async () => {
    try {
      const response = await axios.post("/api/customer/", newCustomerData);
      const created = response.data;
      await refreshCustomerData();
      setRequestData((prev) => ({
        ...prev,
        customer: created,
        customer_name: created.customer_name,
        send_email_updates: created.send_email_updates,
      }));
      setRequiredFieldsCompleted((prev) => ({ ...prev, customer_name: true }));
      setAddCustomerOpen(false);
      setNewCustomerData({ customer_name: '', email_address: '', send_email_updates: false });
      setNewCustomerEmailError(false);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error.response?.data) {
        const errors = error.response.data;
        if (errors.email_address) {
          setNewCustomerEmailError(true);
        }
      }
    }
  };

  const handleButton = (e) => {
    const { name } = e.target;
    if (name == "dock_number") {
      const dockNum = parseInt(document.getElementById("dock_number").value);
      const dockedTime = dayjs().format("YYYY-MM-DD HH:mm:ss");
      if (!(requestData.sms_consent && requestData.driver_phone_number)) {
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


  const handleApprove = () => {
    requestData.approved = true;
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

  const buildPayload = () => ({
    ...requestData,
    customer_id: requestData.customer?.id ?? null,
    date_time: dayjs(requestData.date_time).format("YYYY-MM-DD HH:mm:ss"),
  });

  const flushCustomerEmailDraft = async () => {
    if (!editingCustomerEmail || !requestData.customer) return;
    if (customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft)) return;
    try {
      await axios.patch(`/api/customer/${requestData.customer.id}/`, { email_address: customerEmailDraft });
      setRequestData((prev) => ({
        ...prev,
        customer: { ...prev.customer, email_address: customerEmailDraft },
      }));
      setEditingCustomerEmail(false);
    } catch (error) {
      console.error("Error saving customer email on submit:", error);
    }
  };

  const handleNewRequest = async () => {
    if (path === "/Calendar") {
      requestData.approved = true;
    }

    await flushCustomerEmailDraft();

    try {
      const response = await axios.post("/api/request/", buildPayload());

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
    await flushCustomerEmailDraft();
    try {
      const response = await axios.put(
        `/api/request/${requestData.id}/`,
        buildPayload()
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

        if (errors.twilio_error) {
          queryClient.invalidateQueries(["pendingRequests"]);
          queryClient.invalidateQueries(["requests"]);
          setFormAlert({ message: `SMS notification failed: ${errors.twilio_error}`, severity: "warning" });
          return;
        }
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


  return (
    <Box>
      <Dialog open={addCustomerOpen} onClose={() => { setAddCustomerOpen(false); setNewCustomerEmailError(false); }}>
        <DialogTitle textAlign="center">Add New Customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, "& .MuiTextField-root": { width: "40ch" } }}>
            <TextField
              required
              label="Customer Name"
              value={newCustomerData.customer_name}
              onChange={(e) => setNewCustomerData((prev) => ({ ...prev, customer_name: e.target.value }))}
              autoComplete="off"
            />
            <TextField
              label="Email Address"
              value={newCustomerData.email_address}
              error={newCustomerEmailError}
              helperText={newCustomerEmailError ? "Please enter a valid email address" : ""}
              onChange={(e) => {
                const val = e.target.value;
                setNewCustomerData((prev) => ({ ...prev, email_address: val }));
                setNewCustomerEmailError(val ? !validateEmail(val) : false);
              }}
              autoComplete="off"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newCustomerData.send_email_updates}
                  onChange={(e) => setNewCustomerData((prev) => ({ ...prev, send_email_updates: e.target.checked }))}
                />
              }
              label="Send email updates"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => { setAddCustomerOpen(false); setNewCustomerEmailError(false); }}>Cancel</MuiButton>
          <MuiButton
            variant="contained"
            disabled={!newCustomerData.customer_name || newCustomerEmailError}
            onClick={handleCreateCustomer}
          >
            Create
          </MuiButton>
        </DialogActions>
      </Dialog>

      <Dialog open={declineConfirmOpen} onClose={() => setDeclineConfirmOpen(false)}>
        <DialogTitle textAlign="center">Decline Request</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Are you sure you want to decline this request?
          </Typography>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setDeclineConfirmOpen(false)} variant="contained">
            Go Back
          </MuiButton>
          <MuiButton
            autoFocus
            variant="contained"
            color="error"
            onClick={() => {
              setDeclineConfirmOpen(false);
              requestData.active = false;
              updateRequest();
            }}
          >
            Decline
          </MuiButton>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}>
        <DialogTitle textAlign="center">Cancel Appointment</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Are you sure you want to cancel this appointment?
          </Typography>
        </DialogContent>
        <DialogActions>
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
            disabled={request && path != "/PendingRequests" && !editAppointment ? true : false}
          ></TextField>

          <TextField
            required={requiredFields.includes("phone_number")}
            label="Phone Number"
            name="phone_number"
            value={requestData.phone_number ?? ""}
            onChange={handleChange}
            autoComplete="off"
            error={phoneError}
            helperText={phoneError ? "Phone number must be 10 digits" : ""}
            disabled={request && path != "/PendingRequests" && !editAppointment ? true : false}
            InputProps={{
              inputComponent: PhoneMaskCustom,
            }}
          ></TextField>

          <TextField
            required={requiredFields.includes("email")}
            label="Email"
            name="email"
            value={requestData.email ?? ""}
            onChange={handleChange}
            autoComplete="off"
            error={emailError}
            helperText={emailError ? "Please enter a valid email address" : ""}
            disabled={request && path != "/PendingRequests" && !editAppointment ? true : false}
          ></TextField>

          <TextField
            required={requiredFields.includes("ref_number")}
            label="Reference Number"
            name="ref_number"
            value={requestData.ref_number}
            onChange={handleChange}
            autoComplete="off"
            disabled ={
              (request && path != "/PendingRequests") ||
              requestData.load_type == "Container" ||
              editAppointment
                ? true
                : false
            }
          ></TextField>

          {path !== "/RequestForm" && (
            <>
              <Autocomplete
                disabled={request && path !== "/PendingRequests" && !editAppointment}
                value={
                  requestData.customer
                    ? (customerData.find((c) => c.id === requestData.customer.id) ?? null)
                    : null
                }
                onChange={handleCustomerChange}
                options={[
                  ADD_CUSTOMER_OPTION,
                  ...[...customerData].sort((a, b) =>
                    a.customer_name.localeCompare(b.customer_name)
                  ),
                ]}
                groupBy={(option) =>
                  option.id === '__add__'
                    ? ''
                    : option.customer_name[0].toUpperCase()
                }
                getOptionLabel={(option) => option.customer_name}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {option.customer_name}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer Name"
                    required={requiredFields.includes("customer_name")}
                  />
                )}
                renderGroup={(params) => (
                  <li key={params.key}>
                    {params.group && <GroupHeader>{params.group}</GroupHeader>}
                    <GroupItems>{params.children}</GroupItems>
                  </li>
                )}
              />
              {requestData.customer && (
                <Box sx={{ mx: 1 }}>
                  <TextField
                    label="Customer Email"
                    size="small"
                    value={editingCustomerEmail ? customerEmailDraft : (requestData.customer.email_address || '')}
                    disabled={!editingCustomerEmail}
                    error={editingCustomerEmail && customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft)}
                    helperText={editingCustomerEmail && customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft) ? "Please enter a valid email address" : ""}
                    onChange={(e) => setCustomerEmailDraft(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {editingCustomerEmail ? (
                            <IconButton
                              size="small"
                              disabled={customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft)}
                              onClick={async () => {
                                try {
                                  await axios.patch(`/api/customer/${requestData.customer.id}/`, { email_address: customerEmailDraft });
                                  await refreshCustomerData();
                                  setRequestData((prev) => ({
                                    ...prev,
                                    customer: { ...prev.customer, email_address: customerEmailDraft },
                                  }));
                                  setEditingCustomerEmail(false);
                                } catch (error) {
                                  console.error("Error updating customer email:", error);
                                }
                              }}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <IconButton
                              size="small"
                              disabled={request && path !== "/PendingRequests" && !editAppointment}
                              onClick={() => {
                                setCustomerEmailDraft(requestData.customer.email_address || '');
                                setEditingCustomerEmail(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                    }}
                  />
                  {((path === "/Calendar" && !request) || (path === "/PendingRequests" && request && !request.approved)) && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={requestData.send_email_updates}
                          onChange={(e) =>
                            setRequestData((prev) => ({ ...prev, send_email_updates: e.target.checked }))
                          }
                        />
                      }
                      label="Send email updates to customer"
                    />
                  )}
                </Box>
              )}
            </>
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
            disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
            SelectProps={{ MenuProps: { disablePortal: true } }}
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
            disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
            SelectProps={{ MenuProps: { disablePortal: true } }}
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
                disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
              />
              <TextField
                required={requiredFields.includes("container_number")}
                label="Intermodal Container Number"
                name="container_number"
                value={requestData.container_number ?? ""}
                onChange={handleChange}
                autoComplete="off"
                disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
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
              requestData.delivery == null || requestData.delivery === ""
                ? ""
                : requestData.delivery
                ? "delivery"
                : "pickup"
            }
            onChange={handleChange}
            autoComplete="off"
            disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
            SelectProps={{ MenuProps: { disablePortal: true } }}
          >
            <MenuItem key={"delivery"} value={"delivery"}>
              Delivery
            </MenuItem>
            <MenuItem key={"pickup"} value={"pickup"}>
              Pickup
            </MenuItem>
          </TextField>

          {/* Trailer Number and Notes in default position — hidden when viewing from Calendar */}
          {!(path === "/Calendar" && request && !editAppointment) && (
            <>
              {requestData.load_type !== "Container" && (
                <TextField
                  label="Trailer Number"
                  name="trailer_number"
                  value={requestData.trailer_number ?? ""}
                  onChange={handleChange}
                  autoComplete="off"
                  disabled={request && path !== "/PendingRequests" && !editAppointment}
                />
              )}
              <TextField
                name="note_section"
                label="Notes"
                multiline
                rows={4}
                value={requestData.note_section ?? ""}
                onChange={handleChange}
                autoComplete="off"
                disabled={request && path !== "/PendingRequests" && !editAppointment}
                sx={{ whiteSpace: "pre-wrap" }}
              />
            </>
          )}
          {requestData.warehouse === "" ? null : request && path != "/PendingRequests" && !editAppointment ? (
            <DateTimeField
              disabled
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
                  popper: { disablePortal: true },
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

          {/* Calendar view — Trailer Number and Notes repositioned below DateTime */}
          {path === "/Calendar" && request && !editAppointment && (
            <>
              {requestData.load_type !== "Container" && (
                <TextField
                  label="Trailer Number"
                  name="trailer_number"
                  value={requestData.trailer_number ?? ""}
                  onChange={handleChange}
                  autoComplete="off"
                  disabled={requestData.check_in_time != null}
                />
              )}
              {/* Pre check-in or completed: Notes sits under Trailer Number */}
              {(requestData.check_in_time == null || requestData.completed_time != null) && (
                <TextField
                  name="note_section"
                  label="Notes"
                  multiline
                  rows={4}
                  value={requestData.note_section ?? ""}
                  onChange={handleChange}
                  autoComplete="off"
                  disabled={requestData.completed_time != null}
                  sx={{ whiteSpace: "pre-wrap" }}
                />
              )}
            </>
          )}

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
          <FormActions
            requestData={requestData}
            path={path}
            editAppointment={editAppointment}
            driverPhoneError={driverPhoneError}
            formAlert={formAlert}
            handleChange={handleChange}
            handleButton={handleButton}
            updateRequest={updateRequest}
            handleNewRequest={handleNewRequest}
            handleApprove={handleApprove}
            setCancelConfirmOpen={setCancelConfirmOpen}
            setDeclineConfirmOpen={setDeclineConfirmOpen}
            submitButtonDisabled={submitButtonDisabled}
          />
        </Stack>
      </FormControl>
    </Box>
    </Box>
  );
}

export default Form;

