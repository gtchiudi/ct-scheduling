import React from "react";
import dayjs from "dayjs";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  Box,
  FormControl,
  FormLabel,
  MenuItem,
  Typography,
} from "@mui/material";

const RequestForm = () => {
  return (
    <Typography textAlign="center">
      <Box
        component="form"
        sx={{
          "& > :not(style)": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
      >
        <div>
          <FormControl>
            <FormLabel>Request A Delivery</FormLabel>
            <TextField
              required
              id="outlined-required"
              label="Company Name"
            ></TextField>
            <br></br>
            <TextField
              required
              id="outlined-number"
              label="Phone Number"
            ></TextField>

            <Button>Submit</Button>
          </FormControl>
        </div>
      </Box>
    </Typography>
  );
};

export default RequestForm;
