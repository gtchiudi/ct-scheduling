import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
//import dayjs from "dayjs";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Checkbox,
  Box,
  FormControl,
  FormLabel,
  MenuItem,
  Typography,
  Stack,
} from "@mui/material";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataAtom, updateWarehouseDataAtom } from "./atoms.jsx";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import { DateTimePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessTokenAtom } from "./atoms.jsx";
//import { error } from "console";

// Use FilledForm for elements that will be autopopulated with request information
// As it stands the filled form can only display data and will be updated with buttons
// The buttons will handle accepting, notifications to drivers, docked, completed, etc.
// To use the filled form just pass in request data from whatever page you are using the filled form on.
// The form shuold be as simple to implement as possible, if any code (other than styling) is being done to implement a form then it needs added here.

export default function Form({ closeModal, dateTime }) {
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);
  const queryClient = useQueryClient();
  React.useEffect(() => {
    updateWarehouseData();
  }, [updateWarehouseData]);

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

  const [company_name, setcompany_name] = useState("");
  const [phone_number, setphone_number] = useState("");
  const [email, setemail] = useState("");
  const [po_number, setpo_number] = useState("");
  const [warehouse, setwarehouse] = useState("");
  const [load_type, setload_type] = useState("");
  const [date_time, setdate_time] =
    dateTime == null
      ? useState(dayjs().add(1, "hour").startOf("hour"))
      : useState(dayjs(dateTime).startOf("hour"));
  const [delivery, setdelivery] = useState(false);
  const [container, setcontainer] = useState(false);
  const [con_number, setcon_number] = useState("");
  const [notes, setnotes] = useState("");
  //const [submitted, setSubmitted] = useState(false);

  const history = useNavigate();
  const path = useLocation().pathname;

  const AddDeliveryRequest = async () => {
    let formField = new FormData();

    if (path == "/calendar" || path == "/Calendar") {
      formField.append("approved", true);
    }

    formField.append("company_name", company_name);
    formField.append("phone_number", phone_number);
    formField.append("email", email);
    formField.append("po_number", po_number);
    formField.append("warehouse", warehouse);
    formField.append("load_type", load_type);
    formField.append("container_drop", container);
    formField.append("container_number", con_number);
    formField.append("date_time", date_time.format("YYYY-MM-DD HH:mm:ss"));
    formField.append("active", true);
    formField.append("delivery", delivery);
    formField.append("note_section", notes);

    await axios({
      method: "post",
      url: "/api/request/", // Terribly unsure what URL to put here so I'm just hoping this one is right. Will need Gino to confirm
      data: formField,
    }).then((response) => {
      console.log(response.data);
      if (path == "/calendar" || path == "/Calendar") {
        queryClient.invalidateQueries("requests");
        closeModal();
      } else history("/");
    });
  };

  /*
  ----------------------------------------------------------------------------------------------
  The following code deals with determining what hours are unavailable for a sepcific date.
  findTimes makes a get request based on the date from the DateTimePicker onChange function
    The response contains only the requests for that particular date
    The date_time of each response for a particular date is added to the extractHours variable
      which is then assigned to the state variable of times
  getTimes is called by the ShouldDiasbleTime prop attached to the DateTimePicker
    it returns boolean based on whether a time is contained within the times state 
    Note: This disables the full hour. It should probably only disable a 15-30 minute window within 
          the time frame of an existing request. That's a lot of logic I didn't feel like putting in yet.
    *** THIS STILL NEEDS UPDATED TO CONTAIN TIMES OUTSIED OF WORKING HOURS ***
  */

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

  const result = useQuery({
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

  const getTimes = (date) => {
    const formatted = dayjs(date).format("HH:mm");
    const unavailableTimes = times.includes(formatted);
    return unavailableTimes;
  };

  // --------------------------------------------------------------------------------------------

  return (
    <Typography textAlign={"center"}>
      <FormControl>
        <Box
          component="form"
          justifyContent="center"
          alignItems="center"
          display="flex"
          margin="normal"
          sx={{
            "& .MuiTextField-root": { m: 1, width: "40ch" },
            "& > :not(style)": { m: 1, width: "40ch" },
          }}
          noValidate
          autoComplete="off"
        >
          <div>
            <FormLabel for="company_name">Request A Delivery</FormLabel>
            <TextField
              required
              id="company_name"
              name="company_name"
              value={company_name}
              label="Company Name"
              variant="filled"
              onChange={(e) => setcompany_name(e.target.value)}
            ></TextField>
            <br></br>

            <TextField
              id="phone_number"
              name="phone_number"
              value={phone_number}
              label="Phone Number"
              variant="filled"
              onChange={(e) => setphone_number(e.target.value)}
            ></TextField>
            <br></br>

            <TextField
              required
              id="email"
              name="email"
              value={email}
              label="E-mail"
              variant="filled"
              onChange={(e) => setemail(e.target.value)}
            ></TextField>
            <br></br>

            <TextField
              required
              id="po_number"
              name="po_number"
              value={po_number}
              label="PO Number"
              variant="filled"
              onChange={(e) => setpo_number(e.target.value)}
            ></TextField>
            <br></br>

            <TextField
              select
              required
              id="warehouse"
              label="Warehouse"
              variant="filled"
              value={warehouse}
              onChange={(e) => setwarehouse(e.target.value)}
            >
              {warehouseData.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
            <br></br>

            <TextField
              select
              required
              id="load_type"
              label="Load Type"
              variant="filled"
              value={load_type}
              onChange={(e) => setload_type(e.target.value)}
            >
              {load_types.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value}
                </MenuItem>
              ))}
            </TextField>

            <FormGroup>
              {load_type === "Container" ? (
                <Box>
                  <TextField
                    id="con_number"
                    label="Container Number"
                    variant="filled"
                    value={con_number}
                    onChange={(e) => setcon_number(e.target.value)}
                  />
                  <FormControlLabel
                    control={<Checkbox />}
                    label="Select for container drop."
                    load_type={"Container"}
                    onChange={(e) => setcontainer(e.target.checked)}
                  />
                </Box>
              ) : null}
              <FormControlLabel
                control={<Checkbox />}
                label="Select for delivery"
                onChange={(e) => setdelivery(e.target.checked)}
              />
            </FormGroup>

            <TextField
              id="notes"
              label="Notes"
              multiline
              rows={4}
              value={notes}
              onChange={(e) => setnotes(e.target.value)}
            />

            <FormGroup>
              <DateTimePicker
                disablePast
                closeOnSelect={false}
                label="Select Request Date"
                value={date_time}
                shouldDisableTime={getTimes}
                onChange={findTimes}
                onAccept={(e) => setdate_time(e)}
                timeSteps={{ hours: 1, minutes: 15 }}
              />
            </FormGroup>

            <Button onClick={AddDeliveryRequest}>Submit</Button>
          </div>
        </Box>
      </FormControl>
    </Typography>
  );
}

// The FilledForm will be used to allow CT employees the ability to modify a request
// This form also contains information that is restricted to employees only.
// As well as accept, deny, progress a request through buttons.
// Buttons are made available depending on the state of the request, that state is pulled from the request data.

export function EditForm({ request, closeModal }) {
  const queryClient = useQueryClient();
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);
  const [accessToken] = useAtom(accessTokenAtom);

  React.useEffect(() => {
    updateWarehouseData();
  }, [updateWarehouseData]);

  const [requestData, setRequestData] = useState({
    id: request.id || null,
    approved: request.approved || false,
    company_name: request.company_name || null,
    phone_number: request.phone_number || null,
    email: request.email || null,
    warehouse: request.warehouse || null,
    po_number: request.po_number || null,
    load_type: request.load_type || null,
    container_drop: request.container_drop || false,
    container_number: request.container_number || null,
    note_section: request.note_section || null,
    date_time: dayjs(request.date_time) || new dayjs(),
    delivery: request.delivery || false,
    trailer_number: request.trailer_number || null,
    driver_phone_number: request.driver_phone_number || null,
    dock_number: request.dock_number || null,
    check_in_time: request.check_in_time || null,
    docked_time: request.docked_time || null,
    completed_time: request.completed_time || null,
    active: request.active || true,
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "container_drop" || name === "delivery") {
      setRequestData({ ...requestData, [name]: e.target.checked });
      return;
    }
    setRequestData({ ...requestData, [name]: value });
  };

  const handleButton = (e) => {
    const { name } = e.target;
    console.log("HandleButton Function Call", { name });
    if (name == "dock_number") {
      console.log(document.getElementById("dock_number_text").value);
      requestData[name] = document.getElementById("dock_number_text").value;
    } else {
      const time = dayjs().format("HH:mm:ss");
      requestData[name] = time;
      name == "completed_time" ? (requestData.active = false) : true;
    }
    updateRequest();
  };

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: date,
    });
  };

  const handleApprove = () => {
    requestData.approved = true;
    requestData.date_time = requestData.date_time.format("YYYY-MM-DD HH:mm:ss");
    updateRequest();
  };

  const handleDeny = () => {
    requestData.approved = false;
    requestData.date_time = requestData.date_time.format("YYYY-MM-DD HH:mm:ss");
    requestData.active = false;
    updateRequest();
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
  // BUTTONS ARE MISSING onClick FUNCTIONALITY
  // Conditional rendering
  let formButton;
  let formBottom;
  let formEnd = (
    <TextField
      required
      label="Driver Phone #"
      name="driver_phone_number"
      value={requestData.driver_phone_number}
      onChange={handleChange}
    />
  );
  let checkedContent = (
    <div>
      <TextField
        readOnly
        label="Checked-In Time"
        name="checked_in_time"
        value={requestData.check_in_time}
      />

      <TextField
        required
        id="dock_number_text"
        label="Dock #"
        name="dock_number"
        value={requestData.dock_number}
        //onChange={}
      />
    </div>
  );
  let dockedContent = (
    <div>
      {" "}
      {checkedContent}
      <TextField
        readOnly
        label="Docked Time"
        name="docked_time"
        value={requestData.docked_time}
      />
    </div>
  );
  let completionContent;

  if (
    useLocation().pathname == "/calendar" ||
    useLocation().pathname == "/Calendar"
  ) {
    if (requestData.check_in_time == null) {
      formButton = (
        <Button name="check_in_time" variant="contained" onClick={handleButton}>
          Check-In
        </Button>
      );

      formBottom = (
        <Box>
          {" "}
          {formEnd} {formButton}{" "}
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
          {" "}
          {formEnd} {checkedContent} {formButton}{" "}
        </Box>
      );
    } else if (requestData.docked_time == null) {
      formButton = (
        <Button name="docked_time" variant="contained" onClick={handleButton}>
          Dock Truck
        </Button>
      );

      formBottom = (
        <Box>
          {" "}
          {formEnd} {checkedContent} {formButton}{" "}
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
          {" "}
          {formEnd} {checkedContent} {formButton}{" "}
        </Box>
      );
    }
  }

  if (!requestData.approved) {
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
        sx={{
          "& .MuiTextField-root": { m: 1, width: "60ch" },
          "& > :not(style)": { m: 1, width: "60ch" },
          maxHeight: "90vh",
          maxWidth: "60vw",
        }}
        noValidate
        autoComplete="off"
      >
        <TextField
          label="Company Name"
          name="company_name"
          value={requestData.company_name}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="Phone Number"
          name="phone_number"
          value={requestData.phone_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="Email"
          name="email"
          value={requestData.email}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="PO Number"
          name="po_number"
          value={requestData.po_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          select
          id="warehouse"
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

        <div>
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
        </div>

        <DateTimePicker
          value={dayjs(requestData.date_time)}
          onChange={(newValue) => handleDateChange(newValue)}
        />

        <Box>
          <FormControlLabel
            control={<Checkbox />}
            label="Delivery"
            name="delivery"
            checked={requestData.delivery}
            onChange={handleChange}
          />
        </Box>

        <TextField
          label="Trailer Number"
          name="trailer_number"
          value={requestData.trailer_number}
          onChange={handleChange}
        />

        {formBottom}
      </Stack>
    </FormControl>
  );
}
