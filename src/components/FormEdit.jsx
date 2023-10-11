import React, { useState } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Box,
  FormControl,
  FormLabel,
  MenuItem,
  Typography,
  Modal,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import axios from "axios";
import { useAtom } from "jotai";
import { warehouseDataAtom, updateWarehouseDataAtom } from "./atoms.jsx";
import dayjs from "dayjs";

function FormEdit(request) {
  console.log("form edit request: ", request);
  console.log("form edit request id: ", request.request.id);
  const [open, setOpen] = React.useState(true);
  const handleClose = () => setOpen(false);
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

  const [requestData, setRequestData] = useState({
    id: request.request.id,
    company_name: request.request.company_name || "",
    phone_number: request.request.phone_number || "",
    email: request.request.email || "",
    po_number: request.request.po_number || "",
    warehouse: request.request.warehouse || "",
    load_type: request.request.load_type || "",
    container_number: request.request.container_number || "",
    notes: request.request.note_section || "",
    date_time: dayjs(request.request.date_time) || new dayjs(),
    isDelivery: request.request.delivery || false,
    trailerNum: request.request.trailer_number || "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: date.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"),
    });
    setSubmitted(false);
  };

  const AddDeliveryRequest = async () => {
    try {
      await axios({
        method: "post",
        url: "http://localhost:5173/api/request/", // Terribly unsure what URL to put here so I'm just hoping this one is right. Will need Gino to confirm
        data: requestData,
      }).then((response) => {
        console.log(response.data);
      });
      setOpen(false);
    } catch (error) {
      console.error("Error editing delivery request:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...requestData, [name]: value });
  };
  return (
    <Modal open={open} onClose={handleClose} aria-describedby="modal-form">
      <Box
        component="form"
        justifyContent="center"
        alignItems="center"
        display="flex"
        margin="normal"
        noValidate
        autoComplete="off"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          bgcolor: "background.paper",
          boxShadow: 24,
          p: 4,
        }}
      >
        <Typography textAlign={"center"} id="modal-form">
          <FormControl>
            <div>
              <FormLabel htmlFor="company_name">Request Edit</FormLabel>
              <br />
              <TextField
                required
                id="company_name"
                name="company_name"
                value={requestData.company_name}
                label="Company Name"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                id="phone_number"
                name="phone_number"
                value={requestData.phone_number}
                label="Phone Number"
                variant="standard"
                onChange={handleChange}
              />
              <br />
              <TextField
                required
                id="email"
                name="email"
                value={requestData.email}
                label="E-mail"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                required
                id="po_number"
                name="po_number"
                value={requestData.po_number}
                label="PO Number"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                select
                required
                id="warehouse"
                name="warehouse"
                label="Warehouse"
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
              <br />
              <TextField
                select
                required
                id="load_type"
                name="load_type"
                label="Load Type"
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
              <br />
              <DatePicker
                value={requestData.date_time}
                onChange={handleDateChange}
              />
              <br />
              <Button onClick={AddDeliveryRequest} variant="contained">
                Approve
              </Button>
            </div>
          </FormControl>
        </Typography>
      </Box>
    </Modal>
  );
}

export default FormEdit;


  // <Form
  //  _company = {requestData.company_name}
  //  _phone = {requestData.phone_number}
  //   etc..
  //></Form>
  // Replaces <FormControl>
