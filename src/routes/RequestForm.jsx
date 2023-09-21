import React from "react";
import dayjs from "dayjs";
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Box, FormControl, FormLabel, MenuItem, Typography } from '@mui/material';

const RequestForm = () => {

    const warehouses = [
        {
            value: 'Aurora',
        },
        {
            value: 'Euclid',
        },
        {
            value: 'Cochran',
        },
    ]

    const loads = [
        {
            value: 'Full',
        },
        {
            value: 'LTL',
        },
        {
            value: 'Container',
        },
    ]

    return (   
        <FormControl>            
            <FormLabel >Request A Delivery</FormLabel>
            <Box
                component="form"
                justifyContent="center"
                alignItems="center"
                display="flex"
                margin="normal"
                sx={{
                    '& .MuiTextField-root': { m: 1, width: '25ch' }
                }}
                noValidate
                autoComplete="off"
            >
                <div>         
                    <label for="Cname">Company Name:</label>
                    <br></br>
                    <label>Phone Number:</label>
                    <br></br>
                    <label>E-mail Address:</label>
                    <br></br>
                    <label>PO Number:</label>
                    <br></br>
                    <label>Warehouse:</label>
                    <br></br>
                </div>
                <div>    
                    <TextField
                        required
                        id="Cname"
                        label="Company Name"
                        variant="filled"
                        textAlign="right"
                    ></TextField>
                    <br></br>
                    
                    <TextField
                        id="PNumber"
                        label="Phone Number"
                        variant="standard"
                        textAlign="right"
                    ></TextField>
                    <br></br>

                    <TextField
                        required
                        id="EMail"
                        label="E-mail"
                        variant="filled"
                    ></TextField>
                    <br></br>

                    <TextField
                        id="PONumber"
                        label="PO Number"
                        variant="filled"
                    ></TextField>
                    <br></br>

                    <TextField
                        select
                        id="Warehouse"
                        label="Warehouse"
                        variant="filled"
                    >
                        {warehouses.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.value}
                        </MenuItem>
                        ))}
                    </TextField>
                    <br></br>
                
                    <Button>Submit</Button>                
                </div> 

            </ Box>
        </FormControl>
   );
};

export default RequestForm;