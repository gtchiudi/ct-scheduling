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
import CloseIcon from "@mui/icons-material/Close";
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
import { toApiDateTime } from "../utils/datetime.js";

const ADD_CUSTOMER_OPTION = { id: '__add__', customer_name: '+ Add New Customer', email_address: '', send_email_updates: false };

export const APPOINTMENT_LENGTH_OPTIONS = [
  { label: '15 Minutes', value: 15 },
  { label: '30 Minutes', value: 30 },
  { label: '45 Minutes', value: 45 },
  { label: '1 Hour',     value: 60 },
  { label: '1.5 Hours',  value: 90 },
  { label: '2 Hours',    value: 120 },
  { label: '2.5 Hours',    value: 150 },
  { label: '3 Hours',    value: 180 },
  { label: '4 Hours',    value: 240 },
];

function Form({ request, closeModal, dateTime, onLockChange }) {
  const queryClient = useQueryClient();
  const [warehouseData, refreshWarehouseData] = useAtom(warehouseDataEffectAtom);
  const [customerData, refreshCustomerData] = useAtom(customerDataEffectAtom);
  const [editAppointment, setEditAppointment] = useAtom(editAppointmentAtom);
  const path = useLocation().pathname;
  const navigate = useNavigate();

  const [pauseQuery, setPause] = useState(false);
  const [times, setTimes] = useState([]);

  // Bumped each time a warehouse is picked on /RequestForm, which kicks off the
  // first-available-slot search below. A counter rather than a boolean so that
  // switching warehouses mid-search re-triggers the effect (and cancels the
  // search already running) instead of silently keeping the first answer.
  const [firstAvailableRequest, setFirstAvailableRequest] = useState(0);
  
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isSavingCustomerEmail, setIsSavingCustomerEmail] = useState(false);
  const [customerEmailSaveError, setCustomerEmailSaveError] = useState(false);
  const [containerWarnOpen, setContainerWarnOpen] = useState(false);
  // Local-only acknowledgement; never added to requestData, so it can never be sent to the backend.
  const [paperworkScanned, setPaperworkScanned] = useState(false);

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
    appointment_length: 15,
    delivery: "",
    load_config: "",
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
  const [refNumbers, setRefNumbers] = useState([""]);

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
    { value: "Full", },
    { value: "LTL",  },
    { value: "Container", },
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
      const parsedRefNumbers = (request.ref_number || "").split(";").map(s => s.trim()).filter(Boolean);
      setRefNumbers(parsedRefNumbers.length > 0 ? parsedRefNumbers : [""]);
      setRequiredFieldsCompleted((prev) => {
        // Compute fields based on the loaded data, not the current requiredFields.
        const fieldsToSeed = ["company_name", "warehouse", "ref_number", "load_type", "delivery"];
        if (path === "/RequestForm") fieldsToSeed.push("phone_number", "email");
        if (path === "/PendingRequests" || path === "/Calendar") fieldsToSeed.push("customer_name", "customer");

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
      await axios.get("/api/request/slots/", {
        params: {
          start_date: dayjs(selectedDate).startOf("date").toDate(),
          end_date: dayjs(selectedDate).endOf("date").toDate(),
        },
      }),
    refetchInterval: 300000, // refetches every 300 seconds
    retry: 3,
    enabled: !pauseQuery && path === "/RequestForm",
    onSuccess: (data) => {
      const tz = warehouseData.find((w) => w.id === requestData.warehouse)?.timezone;
      const extractTimes = data.data.map((entry) => {
        return {
          // The picker runs in the warehouse's timezone, so the taken slots it
          // is compared against have to be read in that timezone too.
          time: (tz ? dayjs(entry.date_time).tz(tz) : dayjs(entry.date_time)).format("HH:mm"),
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

  const syncRefNumbers = (newArr) => {
    setRefNumbers(newArr);
    const joined = newArr.filter(Boolean).join(";");
    const updates = { ref_number: joined };
    if (requestData.load_type === "Container") {
      updates.container_number = newArr[0] ?? "";
      updates.trailer_number = newArr[0] ?? "";
    }
    setRequestData(prev => ({ ...prev, ...updates }));
    setRequiredFieldsCompleted(prev => ({
      ...prev,
      ref_number: newArr.some(v => v.trim() !== ""),
      ...(requestData.load_type === "Container" && {
        container_number: !!(newArr[0]?.trim()),
        trailer_number: !!(newArr[0]?.trim()),
      }),
    }));
  };

  const handleRefNumberChange = (index, value) => {
    const updated = [...refNumbers];
    updated[index] = value;
    syncRefNumbers(updated);
  };

  const handleAddRefNumber = () => {
    if (refNumbers.length >= 10) return;
    syncRefNumbers([...refNumbers, ""]);
  };

  const handleRemoveRefNumber = (index) => {
    const updated = refNumbers.filter((_, i) => i !== index);
    syncRefNumbers(updated);
  };

  const refNumberLabel = (index) =>
    refNumbers.length === 1 ? "Reference / PO Number" : `Reference / PO Number ${index + 1}`;

  const confirmContainerSwitch = () => {
    const first = refNumbers[0] ?? "";
    setRefNumbers([first]);
    setRequestData(prev => ({
      ...prev,
      load_type: "Container",
      ref_number: first,
      container_number: first,
      trailer_number: first,
    }));
    setRequiredFieldsCompleted(prev => ({
      ...prev,
      ref_number: !!first.trim(),
      container_number: !!first.trim(),
      trailer_number: !!first.trim(),
    }));
    setContainerWarnOpen(false);
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
      const isDelivery = processedValue === "delivery";
      // Palletized/Floor Loaded only applies to deliveries — drop any value
      // already chosen if the appointment flips back to a pickup.
      setRequestData({
        ...requestData,
        [name]: isDelivery,
        load_config: isDelivery ? requestData.load_config : null,
      });
    } else if (type === "checkbox") {
      if (name === "container_drop" && checked && path !== "/RequestForm") {
        // All-day appointments shouldn't occupy a specific appointment time.
        // On /RequestForm the customer still needs to pick a preferred time
        // for dispatch to review, regardless of Container Drop.
        // Anchor 6am to the *warehouse's* timezone, not the browser's — a
        // wall-clock hour needs to be computed against the location it's
        // actually scheduled at, or it can roll onto the wrong day for a
        // creator/viewer sitting in a different timezone than the warehouse.
        const warehouse = warehouseData.find((w) => w.id === requestData.warehouse);
        const tz = warehouse?.timezone;
        const zeroed = tz
          ? dayjs(requestData.date_time).tz(tz).hour(6).minute(0).second(0)
          : dayjs(requestData.date_time).hour(6).minute(0).second(0);
        setRequestData({
          ...requestData,
          [name]: checked,
          date_time: zeroed,
        });
      } else {
        setRequestData({ ...requestData, [name]: checked });
      }
    } else if (name === "load_type" && processedValue === "Container" && refNumbers.length > 1) {
      // Warn user that extra ref numbers will be dropped
      setContainerWarnOpen(true);
      return;
    } else if (
      name === "load_type" &&
      processedValue !== "Container" &&
      (requestData.container_drop || requestData.container_number)
    ) {
      // if the value of load type is not container, but the container drop is true or container number is not empty,
      // reset the container drop, container number, ref number, trailer number
      const firstRef = refNumbers[0] ?? "";
      setRefNumbers([firstRef]);
      setRequestData({
        ...requestData,
        [name]: processedValue,
        container_drop: false,
        container_number: "",
        trailer_number: "",
        ref_number: firstRef,
      });
      setRequiredFieldsCompleted((prevCompleted) => ({
        // reset required fields that we erased.
        ...prevCompleted,
        trailer_number: false,
        ref_number: !!firstRef,
      }));
    } else setRequestData({ ...requestData, [name]: processedValue });

    if (requiredFields.includes(name)) {
      if (type === "checkbox")
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: true,
        }));
      else
        setRequiredFieldsCompleted((prevCompleted) => ({
          ...prevCompleted,
          [name]: !!processedValue,
        }));
    }
    if (name === "warehouse" && path === "/RequestForm") {
      setFirstAvailableRequest((n) => n + 1);
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
    setIsCreatingCustomer(true);
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
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleButton = (e) => {
    const { name } = e.target;
    if (name == "dock_number") {
      const dockNum = requestData.container_drop
        ? null
        : parseInt(document.getElementById("dock_number").value);
      const dockedTime = toApiDateTime(dayjs());
      if (!(requestData.sms_consent && requestData.driver_phone_number)) {
        setFormAlert({
          message: requestData.container_drop
            ? "Driver did not consent to SMS notifications. Please inform them to drop in the yard."
            : "Driver did not consent to SMS notifications. Please inform them of dock number.",
          severity: "warning",
          onAcknowledge: () => {
            updateRequest({ dock_number: dockNum, docked_time: dockedTime });
          },
        });
        return;
      }
      updateRequest({ dock_number: dockNum, docked_time: dockedTime });
    } else if (name == "check_in_time") {
      updateRequest({ check_in_time: toApiDateTime(dayjs()) });
    } else if (name == "completed_time") {
      updateRequest({ completed_time: toApiDateTime(dayjs()) });
    } else if (name == "remove_from_calendar") {
      removeFromCalendar();
    }
  };

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: dayjs(date),
    });
  };


  const handleApprove = () => {
    updateRequest({ approved: true });
  };

  const handleDialogueClose = () => {
    setSuccessOpen(false);
    setRequestData(initialRequestData);
    setRefNumbers([""]);
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
    // Optional and delivery-only: leave it NULL rather than blank when unanswered.
    load_config: (requestData.delivery && requestData.load_config) || null,
    date_time: toApiDateTime(requestData.date_time),
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
      setCustomerEmailSaveError(true);
      setFormAlert({ message: "Failed to save customer email. Please correct it and try again.", severity: "error" });
      return false;
    }
    return true;
  };

  const handleNewRequest = async () => {
    const extraFields = path === "/Calendar" ? { approved: true } : {};

    setIsSubmitting(true);
    if (await flushCustomerEmailDraft() === false) { setIsSubmitting(false); return; }

    try {
      const response = await axios.post("/api/request/", { ...buildPayload(), ...extraFields });

      if (path === "/Calendar") {
        closeModal();
        queryClient.invalidateQueries(["requests"]);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRequest = async (extraFields = {}) => {
    setIsSubmitting(true);
    if (await flushCustomerEmailDraft() === false) { setIsSubmitting(false); return; }
    try {
      const response = await axios.put(
        `/api/request/${requestData.id}/`,
        { ...buildPayload(), ...extraFields }
      );
      setEditAppointment(false);
      closeModal();
      queryClient.invalidateQueries(["pendingRequests"]);
      queryClient.invalidateQueries(["requests"]);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  // Takes the appointment off the calendar without emailing anyone; the API
  // records it as "removed" rather than a decline.
  const removeFromCalendar = async () => {
    setIsSubmitting(true);
    try {
      await axios.post(`/api/request/${requestData.id}/remove/`);
      setEditAppointment(false);
      closeModal();
      queryClient.invalidateQueries(["pendingRequests"]);
      queryClient.invalidateQueries(["requests"]);
    } catch (error) {
      console.error("Error removing appointment from calendar:", error);
      setFormAlert({ message: "Failed to remove the appointment from the calendar. Please try again.", severity: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const warehouseTimezone = React.useMemo(() => {
    const wh = warehouseData.find((w) => w.id === requestData.warehouse);
    return wh?.timezone || null;
  }, [warehouseData, requestData.warehouse]);

  // The bookable window on /RequestForm, in 15-minute slots.
  const WORK_START_HOUR = 8;
  const WORK_END_HOUR = 16;
  const SLOT_MINUTES = 15;
  // Give up rather than walking forward forever if every day is somehow full.
  const MAX_DAYS_SEARCHED = 14;

  // First slot of `day` that still has room, or null if the day is full.
  // `takenTimes` are "HH:mm" strings for this warehouse on that day.
  const firstOpenSlot = (day, takenTimes, appointmentsPerSlot) => {
    let slot = dayjs(day).hour(WORK_START_HOUR).minute(0).second(0).millisecond(0);
    // Milliseconds have to be zeroed here as well: `day` carries whatever
    // milliseconds the clock had when it was built, which would make a 16:00
    // slot compare as still before closing and get offered.
    const close = dayjs(day).hour(WORK_END_HOUR).minute(0).second(0).millisecond(0);
    while (slot.isBefore(close)) {
      const formatted = slot.format("HH:mm");
      const booked = takenTimes.filter((time) => time === formatted).length;
      if (booked < appointmentsPerSlot) return slot;
      slot = slot.add(SLOT_MINUTES, "minute");
    }
    return null;
  };

  // Walks forward from the next work day until it finds a slot with room.
  // This has to read each day's appointments itself: findTimes() only *schedules*
  // the shared query for a day, so anything that inspects `times` in the same
  // tick is still looking at the previous day's answer — which is why this
  // always used to land on the next work day at 08:00 no matter how booked it was.
  const findFirstAvailable = async (warehouseId) => {
    const warehouse = warehouseData.find((w) => w.id === warehouseId);
    const tz = warehouse?.timezone;
    const appointmentsPerSlot = warehouse?.appointments_per_slot ?? 1;
    let day = nextWorkDay(null, tz);

    for (let i = 0; i < MAX_DAYS_SEARCHED; i++) {
      let takenTimes;
      try {
        const response = await axios.get("/api/request/slots/", {
          params: {
            start_date: dayjs(day).startOf("date").toDate(),
            end_date: dayjs(day).endOf("date").toDate(),
          },
        });
        takenTimes = response.data
          .filter((appointment) => appointment.warehouse === warehouseId)
          .map((appointment) =>
            (tz ? dayjs(appointment.date_time).tz(tz) : dayjs(appointment.date_time)).format("HH:mm")
          );
      } catch (error) {
        console.error("Error finding first available time:", error);
        break; // fall back to the plain next work day below
      }

      const slot = firstOpenSlot(day, takenTimes, appointmentsPerSlot);
      if (slot) return slot;
      day = nextWorkDay(day, tz);
    }
    return nextWorkDay(null, tz);
  };

  React.useEffect(() => {
    if (!firstAvailableRequest) return;
    const warehouseId = requestData.warehouse;
    if (!warehouseId) return;

    let cancelled = false;
    (async () => {
      const slot = await findFirstAvailable(warehouseId);
      // Superseded by a newer warehouse choice while this was in flight.
      if (cancelled) return;
      findTimes(slot);
      // Functional update: this resolves a fetch later than the change that
      // started it, so the captured requestData is stale by now and spreading
      // it would undo whatever the user has typed in the meantime.
      setRequestData((prev) => ({ ...prev, date_time: dayjs(slot) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [firstAvailableRequest]);


  return (
    <Box sx={{mx: 1, sm: 3}}>
      <Dialog open={addCustomerOpen} onClose={() => { setAddCustomerOpen(false); setNewCustomerEmailError(false); }}>
        <DialogTitle textAlign="center">Add New Customer</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Stack spacing={2} sx={{ mt: 1, "& .MuiTextField-root": { width: { xs: "100%", sm: "40ch" } } }}>
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
            disabled={!newCustomerData.customer_name || newCustomerEmailError || isCreatingCustomer}
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
            disabled={isSubmitting}
            onClick={() => {
              setDeclineConfirmOpen(false);
              updateRequest({ active: false });
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
            disabled={isSubmitting}
            onClick={() => {
              setCancelConfirmOpen(false);
              updateRequest({ cancelled_time: toApiDateTime(dayjs()) });
            }}
          >
            Cancel Appointment
          </MuiButton>
        </DialogActions>
      </Dialog>

      <Dialog open={containerWarnOpen} onClose={() => setContainerWarnOpen(false)}>
        <DialogTitle textAlign="center">Switch to Container?</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Only the first Reference / PO Number will be kept when switching to Container load type.
            The remaining entries will be removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <MuiButton variant="contained" onClick={() => setContainerWarnOpen(false)}>
            Go Back
          </MuiButton>
          <MuiButton variant="contained" color="error" onClick={confirmContainerSwitch}>
            Proceed
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
    <Box marginBottom={"20px"} display="flex" justifyContent="center" sx={{ px: { xs: 2, sm: 0 } }}>
      <FormControl sx={{ width: { xs: "100%", sm: "auto" } }}>
        <Stack
          spacing={2}
          textAlign={"center"}
          margine="normal"
          sx={{
            width: { xs: "100%", sm: "auto" },
            "& .MuiTextField-root": { width: { xs: "100%", sm: "60ch" } },
            "& > :not(style)": { mx: { xs: 0, sm: 1 }, width: { xs: "100%", sm: "60ch" }, boxSizing: "border-box" },
            maxWidth: { xs: "100%", sm: "70vw" },
          }}
        >
          <TextField
            required={requiredFields.includes("company_name")}
            label={path === "/RequestForm" ? "Company Name" : "Carrier Name"}
            name="company_name"
            value={requestData.company_name}
            onChange={handleChange}
            autoComplete="off"
            disabled={request && path != "/PendingRequests" && !editAppointment ? true : false}
          />

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
          />

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
          />

          {refNumbers.map((val, index) => {
            const isReadOnly = !!(request && path !== "/PendingRequests" && !editAppointment);
            const showAddNew = index === refNumbers.length - 1
              && requestData.load_type !== "Container"
              && path !== "/RequestForm"
              && !isReadOnly;
            const showRemove = index > 0 && !isReadOnly;
            return (
              <TextField
                key={index}
                required={index === 0 && requiredFields.includes("ref_number")}
                label={refNumberLabel(index)}
                value={val}
                onChange={(e) => handleRefNumberChange(index, e.target.value)}
                autoComplete="off"
                disabled={isReadOnly}
                inputProps={{ maxLength: 49 }}
                InputProps={{
                  endAdornment: (showAddNew || showRemove) ? (
                    <InputAdornment position="end">
                      {showAddNew && (
                        <MuiButton
                          size="small"
                          variant="text"
                          onClick={handleAddRefNumber}
                          disabled={refNumbers.length >= 10}
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          Add New
                        </MuiButton>
                      )}
                      {showRemove && (
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveRefNumber(index)}
                          aria-label={`Remove reference number ${index + 1}`}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            );
          })}

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
                <Stack spacing={2} sx={{ mx: 1, width: "100%" }}>
                  <TextField
                    label="Customer Email"
                    size="small"
                    value={editingCustomerEmail ? customerEmailDraft : (requestData.customer.email_address || '')}
                    disabled={!editingCustomerEmail}
                    error={customerEmailSaveError || (editingCustomerEmail && customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft))}
                    helperText={customerEmailSaveError ? "Failed to save. Please try again." : (editingCustomerEmail && customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft) ? "Please enter a valid email address" : "")}
                    onChange={(e) => { setCustomerEmailDraft(e.target.value); setCustomerEmailSaveError(false); }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {editingCustomerEmail ? (
                            <IconButton
                              size="small"
                              disabled={isSavingCustomerEmail || (customerEmailDraft.length > 0 && !validateEmail(customerEmailDraft))}
                              onClick={async () => {
                                setIsSavingCustomerEmail(true);
                                try {
                                  await axios.patch(`/api/customer/${requestData.customer.id}/`, { email_address: customerEmailDraft });
                                  await refreshCustomerData();
                                  setRequestData((prev) => ({
                                    ...prev,
                                    customer: { ...prev.customer, email_address: customerEmailDraft },
                                  }));
                                  setCustomerEmailSaveError(false);
                                  setEditingCustomerEmail(false);
                                } catch (error) {
                                  console.error("Error updating customer email:", error);
                                  setCustomerEmailSaveError(true);
                                } finally {
                                  setIsSavingCustomerEmail(false);
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
                </Stack>
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
            <Stack spacing={2} sx={{ width: "100%" }}>
              <TextField
                label="Intermodal Container Number"
                value={refNumbers[0] || ""}
                onChange={(e) => handleRefNumberChange(0, e.target.value)}
                autoComplete="off"
                disabled={request && path !== "/PendingRequests" && !editAppointment}
                inputProps={{ maxLength: 49 }}
              />
              <FormControlLabel
                control={<Checkbox />}
                label="Select for Container Drop"
                name="container_drop"
                checked={requestData.container_drop}
                onChange={handleChange}
                disabled={request && path !== "/PendingRequests" && !editAppointment}
              />
            </Stack>
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

          {/* Deliveries only — pickups never carry a load configuration. */}
          {requestData.delivery === true && (
            <TextField
              select
              id="load_config"
              label="Palletized or Floor Loaded"
              name="load_config"
              variant="filled"
              value={requestData.load_config ?? ""}
              onChange={handleChange}
              autoComplete="off"
              disabled= {request && path != "/PendingRequests" && !editAppointment ? true : false}
              SelectProps={{ MenuProps: { disablePortal: true } }}
            >
              <MenuItem key={"Palletized"} value={"Palletized"}>
                Palletized
              </MenuItem>
              <MenuItem key={"Floor Loaded"} value={"Floor Loaded"}>
                Floor Loaded
              </MenuItem>
            </TextField>
          )}

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
            <>
              <DateTimeField
                disabled
                label="Appointment Date and Time"
                name="date_time"
                value={dayjs(requestData.date_time)}
              />
              <TextField
                select
                label="Appointment Window"
                value={requestData.appointment_length ?? 15}
                disabled
                size="small"
                SelectProps={{ MenuProps: { disablePortal: true } }}
                onChange={() => {}}
              >
                {APPOINTMENT_LENGTH_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <>
              <DateTimePicker
                disabled={requestData.warehouse === ""}
                views={requestData.container_drop && path !== "/RequestForm" ? ["year", "month", "day"] : undefined}
                ampm={false}
                thresholdToRenderTimeInASingleColumn={30}
                skipDisabled={true}
                label={requestData.container_drop && path !== "/RequestForm" ? "Select Appointment Date" : "Select Appointment Date and Time"}
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
                shouldDisableDate={(date) => {
                  if (path !== "/RequestForm") return false;
                  if (dayjs(date).isSame(dayjs(), "day")) return true;
                  const weekday = dayjs(date).day(); // 0 = Sunday, 6 = Saturday
                  return weekday === 0 || weekday === 6;
                }}
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
              {path !== "/RequestForm" && (
                <TextField
                  select
                  label="Appointment Window"
                  value={requestData.appointment_length ?? 15}
                  onChange={(e) => setRequestData({ ...requestData, appointment_length: e.target.value })}
                  disabled={request && path !== "/PendingRequests" && !editAppointment}
                  size="small"
                  SelectProps={{ MenuProps: { disablePortal: true } }}
                >
                  {APPOINTMENT_LENGTH_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
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
            isSubmitting={isSubmitting}
            paperworkScanned={paperworkScanned}
            onPaperworkScannedChange={(e) => setPaperworkScanned(e.target.checked)}
          />
        </Stack>
      </FormControl>
    </Box>
    </Box>
  );
}

export default Form;

