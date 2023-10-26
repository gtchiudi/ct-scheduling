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
} from "@mui/material";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataAtom, updateWarehouseDataAtom } from "./atoms.jsx";
import { SingleDateSelector, TimeSelector } from "./DateSelector.jsx";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import { DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { error } from "console";

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
  }, []);

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
  const [email,        setemail]        = useState("");
  const [po_number,    setpo_number]    = useState("");
  const [warehouse,    setwarehouse]    = useState("");
  const [load_type,    setload_type]    = useState("");
  const [date_time,    setdate_time]    = useState("");
  const [delivery,     setdelivery]     = useState(false);
  const [container,    setcontainer]    = useState(false);
  const [con_number,   setcon_number]   = useState("");
  const [notes,        setnotes]        = useState("");
  //const [submitted, setSubmitted] = useState(false);

  const _date = "";
  const handleDateChange = (date) => {
    const formattedDate = date.format("YYYY-MM-DD");

    setdate_time(formattedDate);
    //setSubmitted(false);
  };

  const handleTimeChange = (time) => {
    const formattedTime = time.format("HH:mm:ss.SSSSSS[Z]");

    setdate_time(formattedTime);
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
                :
                null
              }

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

            <Box 
              display={"flex"}
              sx={{
                "& .MuiTextField-root": { m: 1, width: "19.1ch" }
              }}
            >
                <SingleDateSelector required onDateChange={handleDateChange} />
                <TimeSelector required onTimeChange={handleTimeChange}/>
            </ Box>
            
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



export function FilledForm({requestData}){

  const [id,           set_id]          = useState(requestData.id);
  const [approved,     setapproved]     = useState(false);
  const [company_name, setcompany_name] = useState(requestData.company_name);
  const [phone_number, setphone_number] = useState(requestData.phone_number);
  const [email,        setemail]        = useState(requestData.email);
  const [po_number,    setpo_number]    = useState(requestData.po_number);
  const [warehouse,    setwarehouse]    = useState(requestData.warehouse);
  const [load_type,    setload_type]    = useState(requestData.load_type);
  const [date_time,    setdate_time]    = useState(requestData.date_time);
  const [delivery,     setdelivery]     = useState(requestData.isDelivery);
  const [container,    setcontainer]    = useState(requestData.con_drop);
  const [con_number,   setcon_number]   = useState(requestData.container_number);
  const [notes,        setnotes]        = useState(requestData.notes);
  const [trailer_num,  settrailer_num]  = useState(requestData.trailerNum);
  const [driver_phone, setdriver_phone] = useState("");
  const [dock_num,     setdock_num]     = useState("");
  const [check_time,   setcheck_time]   = useState(null);
  const [dock_time,    setdock_time]    = useState(null);
  const [com_time,     setcom_time]     = useState(null);
  const [active,       setactive]       = useState(true);

  const UpdateRequest = async () => {
    let formField = new FormData();

    formField.append("id", id);
    formField.append("approved", approved);
    formField.append("company_name", company_name);
    formField.append("phone_number", phone_number);
    formField.append("email", email);
    formField.append("po_number", po_number);
    formField.append("warehouse", warehouse);
    formField.append("load_type", load_type);
    formField.append("container_drop", container);
    formField.append("container_number", con_number);
    formField.append("note_section", notes);
    formField.append("date_time", date_time);
    formField.append("delivery", delivery);
    formField.append("trailer_number", trailer_num);
    formField.append("driver_phone_number", driver_phone);
    formField.append("dock_number", dock_num);
    formField.append("check_in_time", check_time);
    formField.append("docked_time", dock_time);
    formField.append("completed_time", com_time);
    formField.append("active", active);
    
    await axios({
      method: "put",
      url: "http://localhost:5173/api/request/", // Terribly unsure what URL to put here so I'm just hoping this one is right. Will need Gino to confirm
      data: formField,
    }).then((response) => {
      console.log(response.data);
      history("/");
    });
  };

  // This controls the dyanmic display of buttons based on the state of the request
  // BUTTONS ARE MISSING onClick FUNCTIONALITY
  let formButton;
  if (!approved) {

    formButton = <div><Button id="Approve" variant="contained" onClick={handleButton}> Approve </Button> <Button id="Deny" variant="contained" onClick={handleButton}> Deny </Button></div> 

  } else if (requestData.checkedTime == null) {

    formButton = <Button id="Check-In" variant="contained" onClick={handleButton}> Check-In </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime == null) {

    formButton = <Button id="Dock" variant="contained" onClick={handleButton}> Dock </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime != null && requestData.completeTime == null) {
    
    formButton = <Button id="Complete" variant="contained" onClick={handleButton}> Complete </Button>

  } else {

    formButton = <Button disabled variant="contained" color="red"> Error - See Admin </Button>
  
  }

// This handles the updating of the requests status.
// When a button is pressed, this function will be called and depending on the current state
//    of the request will be updated accordingly.
const handleButton = (e) => {
  switch (e.target.id){
    case "Approve":
      setapproved(true);
      break;
    case "Deny":
      setapproved(false);
      setactive(false);
      // should probably trigger an event to tell the requestor to submit anew
      break;
    case "Check-In":
      setcheck_time(dayjs());
      break;
    case "Dock":
      setdock_time(dayjs());
      break;
    case "Complete":
      setcom_time(dayjs());
      break;
    default:
      break;
  }
  UpdateRequest();
}



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
                value={company_name}
                onChange={setcompany_name(value)}
              ></TextField>

              <TextField
                readOnly
                label="Phone Number"
                value={phone_number}
                onChange={setphone_number(value)}
              ></TextField>
                  
              <TextField
                readOnly
                label="Email"
                value={email}
                onChange={setemail(value)}
              ></TextField> 

              <TextField
                readOnly
                label="PO Number"
                value={po_number}
                onChange={setpo_number(value)}
              ></TextField>

              <TextField
                readOnly
                label="Warehouse"
                value={warehouse}
                onChange={setwarehouse(value)}
              ></TextField>

              <TextField
                readOnly
                label="Load Type"
                value={load_type}
                onChange={setload_type(value)}
              ></TextField>

              <FormControlLabel
                readOnly
                control={<Checkbox />}
                label="Container Drop"
                checked={container}
                onChange={setcontainer(value)}
              />

              {(container) ? 
                <TextField
                  readOnly
                  label="Container Number"
                  value={con_number}
                  onChange={setcon_number(value)}
                />
              : null}

              <FormControlLabel
                control={<Checkbox />}
                label="Delivery"
                checked={delivery} 
                onChange={setdelivery(checked)}
              />

              <DateTimeField
                readOnly
                label="Request Time"
                value={date_time}
              />

              <TextField
                readOnly
                label="Trailer Number"
                value={trailer_num}
                onChange={settrailer_num(value)}
              />

              <TextField
                readOnly
                label="Driver Phone #"
                value={driver_phone}
                onChange={setdriver_phone(value)}
              />

              <TextField
                readOnly
                label="Dock Number"
                value={dock_num}
                onChange={setdock_num(value)}
              />

              <TextField
                readOnly
                label="Checked-In Time"
                value={check_time}
                // On change will be handled by buttons below that update the request
              />

              <DateTimeField
                readOnly
                label="Docked Time"
                value={dock_time} // This data is not yet a part of the request (Expected: request.dockTime)
                // On change will be handled by buttons below that update the request
              />

              <DateTimeField
                readOnly
                label="Completed Time"
                value={com_time} // This data is not yet a part of the request (Expected: request.compleTime)
                // On change will be handled by buttons below that update the request
              />

              <TextField
                readOnly
                multiline
                rows={4}
                label="Notes"
                value={notes} 
                onChange={setnotes(value)}
              />

              {formButton}
              
          </div>
        </Box>
      </FormControl>
    </Typography>
  )
}
