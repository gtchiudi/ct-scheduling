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
        <Typography textAlign={"center"}>
        <FormControl>            
            <Box
                component="form"
                justifyContent="center"
                alignItems="center"
                display="flex"
                margin="normal"
                sx={{
                    '& .MuiTextField-root': { m: 1, width: '40ch' },
                    "& > :not(style)": { m: 1, width: "40ch" }
                }}
                noValidate
                autoComplete="off"
            >   
                <div>
                <FormLabel ><h1>Request A Delivery</h1></FormLabel>
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
                        required
                        id="PONumber"
                        label="PO Number"
                        variant="filled"
                    ></TextField>
                    <br></br>

                    <TextField
                        select
                        required
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

                    <TextField
                        select
                        required
                        id="Load"
                        label="Load Type"
                        variant="filled"
                    >
                        {loads.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.value}
                        </MenuItem>
                        ))}
                    </TextField>               
                    <Button>Submit</Button>
                </div>     

            </ Box>
        </FormControl>
        </Typography>
   );
};

export default RequestForm;