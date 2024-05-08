import React from "react";
import Form from "../components/Form.jsx";
import { Box, Typography } from "@mui/material";

function RequestForm() {
  return (
    <Box>
      <Typography variant="h4" textAlign="center" padding="15px">
        Request Form
      </Typography>
      <Box display="flex" justifyContent="center" alignItems="center">
        <Form></Form>
      </Box>
    </Box>
  );
}

export default RequestForm;
