import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { SingleDateSelector, TimeSelector } from "./DateSelector.jsx";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import { DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
//import { error } from "console";

// Use FilledForm for elements that will be autopopulated with request information
// As it stands the filled form can only display data and will be updated with buttons
// The buttons will handle accepting, notifications to drivers, docked, completed, etc.
// To use the filled form just pass in request data from whatever page you are using the filled form on.
// The form shuold be as simple to implement as possible, if any code (other than styling) is being done to implement a form then it needs added here.


export function Form() {
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);

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
  const [date_time, setdate_time] = useState("");
  const [delivery, setdelivery] = useState(false);
  const [container, setcontainer] = useState(false);
  const [con_number, setcon_number] = useState("");
  const [notes, setnotes] = useState("");
  //const [submitted, setSubmitted] = useState(false);

  const _date = "";
  const handleDateChange = (date) => {
    const formattedDate = date.format("YYYY-MM-DD");

    setdate_time(_date + formattedDate);
    //setSubmitted(false);
  };

  const handleTimeChange = (time) => {
    const formattedTime = time.format("HH:mm:ss.SSSSSS[Z]");
    setdate_time(_date + " " + formattedTime);
    //setSubmitted(false);
  };

  const history = useNavigate();

  const AddDeliveryRequest = async () => {
    let formField = new FormData();

    formField.append("company_name",     company_name);
    formField.append("phone_number",     phone_number);
    formField.append("email",            email);
    formField.append("po_number",        po_number);
    formField.append("warehouse",        warehouse);
    formField.append("load_type",        load_type);
    formField.append("container_drop",   container);
    formField.append("container_number", con_number);
    formField.append("date_time",        date_time);
    formField.append("active",           true);
    formField.append("delivery",         delivery);
    formField.append("note_section",     notes);

    await axios({
      method: "post",
      url: "http://localhost:5173/api/request/", // Terribly unsure what URL to put here so I'm just hoping this one is right. Will need Gino to confirm
      data: formField,
    }).then((response) => {
      console.log(response.data);
      history("/");
    });
  };


  
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
              {(load_type === "Container") ?
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
               : null}
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
            <Box
              display={"flex"}
              sx={{
                "& .MuiTextField-root": { m: 1, width: "19.1ch" },
              }}
            >
              <SingleDateSelector required onDateChange={handleDateChange} />
              <TimeSelector required onTimeChange={handleTimeChange} />
            </Box>

              <FormControlLabel 
                control={<Checkbox />} 
                label="Select for delivery"
                onChange={(e) => setdelivery(e.target.checked)}
                />
            </FormGroup>
            
            <Button onClick={AddDeliveryRequest}>Submit</Button>
          </div>
        </Box>
      </FormControl>
    </Typography>
  );
}

// Warehouse is showing as nonsense, not sure how to get that back to plain english
// GIIIIIIIIIIIIIIIIIIINNNNNNNNNNNNNNOOOOOOOOOOOOOOOOOOOOOOOOOO

// The FilledForm will be used to allow CT employees the ability to modify a request
// This form also contains information that is restricted to employees only.
// As well as accept, deny, progress a request through buttons.
// For now the form is ReadOnly, the implementation of confirmation popups will be
//     paramount to ensuring no data is accidentally modified.
// ------
// Buttons are made available depending on the state of the request, that state is pulled from the request data.



export function FilledForm({request}){
  const queryClient = useQueryClient();

  const [requestData, setRequestData] = useState({
    id: request.id || null,
    approved: request.approved || false,
    company_name: request.company_name || "",
    phone_number: request.phone_number || "",
    email: request.email || "",
    warehouse: request.warehouse || "",
    po_number: request.po_number || "",
    load_type: request.load_type || "",
    container_drop: request.container_drop || false,
    container_number: request.container_number || "",
    note_section: request.note_section || "",
    date_time: dayjs(request.date_time) || new dayjs(),
    delivery: request.delivery || false,
    trailer_number: request.trailer_number || "",
    driver_phone_number: request.driver_phone || "",
    dock_number: request.dock_number || "",
    check_in_time: request.check_in_time || null,
    docked_time: request.docked_time || null,
    completed_time: request.completed_time || null,
    active: request.active || true
  });

  const UpdateRequest = async () => {
    
    try { 
      await axios.put(`http://localhost:5173/api/request/${requestData.id}`, requestData
      ).then((response) => {
        console.log(response.data);
      });      
      queryClient.invalidateQueries("PendingRequests");
      (requestData.active) ? null : useNavigate('/RequestList')
    } catch (error) {
      console.error("Error updating request:", error);
      useNavigate('/RequestList')
    };
  };

  // This handles the updating of the requests status.
  // When a button is pressed, this function will be called and depending on the current state
  //    of the request will be updated accordingly.
const handleButton = (e) => {
  const { name } = e.target;
  switch (name){
    case "approve":
      setRequestData({...requestData, [name]: true});
      break;
    case "deny":
      setRequestData({...requestData, [name]: false});
      setactive(false);
      // should probably trigger an event to tell the requestor to submit anew
      break;
    case "check_in_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    case "docked_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    case "completed_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    default:
      break;
  }
  UpdateRequest();
}
  // This controls the dyanmic display of buttons based on the state of the request
  // BUTTONS ARE MISSING onClick FUNCTIONALITY
  let formButton;
  if (!requestData.approved) {

    formButton = <div><Button name="approve" variant="contained" onClick={handleButton}> Approve </Button> <Button id="deny" variant="contained" onClick={handleButton}> Deny </Button></div> 

  } else if (requestData.checkedTime == null) {

    formButton = <Button name="check_in_time" variant="contained" onClick={handleButton}> Check-In </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime == null) {

    formButton = <Button name="docked_time" variant="contained" onClick={handleButton}> Dock </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime != null && requestData.completeTime == null) {
    
    formButton = <Button name="completed_time" variant="contained" onClick={handleButton}> Complete </Button>

  } else {

    formButton = <Button disabled variant="contained" color="red"> Error - See Admin </Button>
  
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "container_drop" || name === "delivery") {
      setRequestData({ ...requestData, [name]: e.target.checked });
      return;
    }
    setRequestData({ ...requestData, [name]: value });
  };


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
            <FormLabel for="company_name">Information for request</FormLabel>
            <TextField
              readOnly
              label="Company Name"
              name="company_name"
              value={requestData.company_name}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Phone Number"
              name="phone_number"
              value={requestData.phone_number}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Email"
              name="email"
              value={requestData.email}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="PO Number"
              name="po_number"
              value={requestData.po_number}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Warehouse"
              name="warehouse"
              value={requestData.warehouse}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Load Type"
              name="load_type"
              value={requestData.load_type}
              onChange={handleChange}
            ></TextField>

            {requestData.container_drop ? (
              <TextField
                readOnly
                label="Container Number"
                name="container_number"
                value={requestData.container_number}
                onChange={handleChange}
              />
            ) : null}

            <FormControlLabel
              control={<Checkbox />}
              label="Delivery"
              name="delivery"
              checked={requestData.delivery}
              onChange={handleChange}
            />

            <DateTimeField readOnly label="Request Time" value={requestData.date_time} />

            <TextField
              readOnly
              label="Trailer Number"
              name="trailer_number"
              value={requestData.trailer_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Driver Phone #"
              name="driver_phone_number"
              value={requestData.driver_phone_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Dock Number"
              name="dock_number"
              value={requestData.dock_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Checked-In Time"
              value={requestData.check_in_time} // This data is not yet a part of the request (Expected: request.checkedTime)
              // On change will be handled by buttons below that update the request
            />

            <DateTimeField
              readOnly
              label="Docked Time"
              value={requestData.docked_time} // This data is not yet a part of the request (Expected: request.dockTime)
              // On change will be handled by buttons below that update the request
            />

            <DateTimeField
              readOnly
              label="Completed Time"
              value={requestData.completed_time} // This data is not yet a part of the request (Expected: request.compleTime)
              // On change will be handled by buttons below that update the request
            />

            <TextField
              readOnly
              multiline
              rows={4}
              label="Notes"
              name="note_section"
              value={requestData.note_section}
              onChange={handleChange}
            />

            {formButton}
          </div>
        </Box>
      </FormControl>
    </Typography>
  );
}

