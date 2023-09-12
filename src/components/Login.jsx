import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography'

export default function BasicTextFields() {
  return (
    <Typography textAlign="center">
    <Box
      component="form"
      sx={{
        '& > :not(style)': { m: 1, width: '25ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <div>
      <h1>Login</h1> 
      <label for="fUsername">Username:</label><br></br>
      <TextField id="Username" label="Enter Username" variant="filled" />
      <label for="fPassword">Password:</label><br></br>
      <TextField id="Password" label="Enter Password" variant="filled" />
      </div>
    </Box>
    </Typography>
  );
}
