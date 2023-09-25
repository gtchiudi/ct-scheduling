import React, {useState} from "react";
//import useHistory from "react-router-dom"
import dayjs from "dayjs";
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { Box, FormControl, FormLabel, MenuItem, Typography } from '@mui/material';
import axios from "axios";

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

    const load_types = [
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

    const [company_name, setcompany_name] = useState('')
    const [phone_number, setphone_number] = useState('')
    const [email, setemail]               = useState('')
    const [po_number, setpo_number]       = useState('')
    const [warehouse, setwarehouse]       = useState('')
    const [load_type, setload_type]       = useState('')

    //const history = useHistory();


    const AddDeliveryRequest = async () => {
        let formField = new FormData()

        formField.append('company_name', company_name)
        formField.append('phone_number', phone_number)
        formField.append('email', email)
        formField.append('po_number', po_number)
        formField.append('warehouse', warehouse)
        formField.append('load_type', load_type)

        await axios({
            method: 'post',
            url: 'http://localhost:5173/api/', // Terribly unsure what URL to put here so I'm just hoping this one is right. Will need Gino to confirm
            data: formField
        }).then((response) => {
            console.log(response.data);
            //history.push('/')
        })

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
                    '& .MuiTextField-root': { m: 1, width: '40ch' },
                    "& > :not(style)": { m: 1, width: "40ch" }
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
                        onChange={e => setwarehouse(e.target.value)}
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
                        id="load_type"
                        label="Load Type"
                        variant="filled"
                        value={load_type}
                        onChange={e=> setload_type(e.target.value)}
                    >
                        {load_types.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.value}
                        </MenuItem>
                        ))}
                    </TextField>               
                    <Button onClick={AddDeliveryRequest}>Submit</Button>
                </div>     

            </ Box>
        </FormControl>
        </Typography>
   );
};

export default RequestForm;