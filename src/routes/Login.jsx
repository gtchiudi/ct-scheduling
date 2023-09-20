import * as React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';

export default function Login() {
  return (
    <Typography textAlign="center">
      <Box
        component="form"
        display= "flex"
        justifyContent="center"
        alignItems="center"
        sx={{
          "& > :not(style)": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
      >
        <div>
          <h1>Login</h1>
          <label for="fUsername">Username:</label>
          <br></br>
          <TextField 
            id="Username"
            
            label="Enter Username" 
            variant="filled" />
          <label for="fPassword">Password:</label>
          <br></br>
          <TextField 
            id="Password" 
            label="Enter Password" 
            variant="filled" />
          <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            /> 
          <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >Submit</Button>   
        </div>
      </Box>
    </Typography>
  );
}
