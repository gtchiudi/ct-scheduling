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
import { FilledForm } from "./Form.jsx";

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
    id: request.request.id || null,
    id: request.request.id,
    company_name: request.request.company_name || "",
    phone_number: request.request.phone_number || "",
    email: request.request.email || "",
    po_number: request.request.po_number || "",
    warehouse: request.request.warehouse || "",
    load_type: request.request.load_type || "",
    con_drop: request.request.container_drop || "",
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
        url: "http://localhost:5173/api/request/",
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
    setRequestData({ ...requestData, [name]: value });
  };
  return (
    <Modal open={open} onClose={handleClose} aria-describedby="modal-form">
      <Box
        component="form"
        justifyContent="center"
        alignItems="center"
        display="block"
        margin="normal"
        noValidate
        autoComplete="off"
        overflow="hidden"
        sx={{
          position: "absolute",
          top: "5%",
          left: "35%",
          width: 500,
          maxHeight: "80%",
          overflow: "scroll",
          bgcolor: "background.paper",
          boxShadow: 24,
          p: 4,       
        }}
      >
        <Typography textAlign={"center"} id="modal-form">
          <FilledForm requestData={requestData} change={handleChange}/>
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