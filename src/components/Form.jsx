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
  const [email, setemail]               = useState("");
  const [po_number, setpo_number]       = useState("");
  const [warehouse, setwarehouse]       = useState("");
  const [load_type, setload_type]       = useState("");
  const [date_time, setdate_time]       = useState("");
  const [delivery, setdelivery]         = useState(false);
  //const [container, setcontainer] = useState(false);
  const [notes, setnotes]               = useState("");
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

    formField.append("company_name", company_name);
    formField.append("phone_number", phone_number);
    formField.append("email", email);
    formField.append("po_number", po_number);
    formField.append("warehouse", warehouse);
    formField.append("load_type", load_type);
    formField.append("date_time", date_time);
    formField.append("active", true);
    formField.append("delivery", delivery);
    formField.append("note_section", notes);

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
              variant="standard"
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
                <FormControlLabel 
                  control={<Checkbox />} 
                  label="Select for container drop." 
                  load_type={"Container"} 
                  //onChange={(e) => setcontainer(e.target.checked)}
                  /> 
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
export function FilledForm({requestData, change}){

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
                value={requestData.company_name}
                onChange={change}
              ></TextField>

              <TextField
                readOnly
                label="Phone Number"
                value={requestData.phone_number}
                onChange={change}
              ></TextField>
                  
              <TextField
                readOnly
                label="Email"
                value={requestData.email}
                onChange={change}
              ></TextField> 

              <TextField
                readOnly
                label="PO Number"
                value={requestData.po_number}
                onChange={change}
              ></TextField>

              <TextField
                readOnly
                label="Warehouse"
                value={requestData.warehouse}
                onChange={change}
              ></TextField>

              <TextField
                readOnly
                label="Load Type"
                value={requestData.load_type}
                onChange={change}
              ></TextField>

              <FormControlLabel
                control={<Checkbox />}
                label="Delivery"
                checked={requestData.isDelivery} 
                onChange={change}
              />
          </div>
        </Box>
      </FormControl>
    </Typography>
  )
}
