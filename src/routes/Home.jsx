import * as React from "react";
import { Box, ThemeProvider, createTheme } from '@mui/system';
import { Typography } from "@mui/material";

export default function Home(){
    return(
        <Typography>
        <Box
        sx={{
            color: '',
            display: 'inline',
            fontWeight: 'bold',
            textAlign: 'center',
            mx: 0.5,
            fontSize: 14,
          }}><h1>Welcome to Candor Logistics</h1>
          </Box>
    
         <img style={{height: '100%',
          width: '100%',}}src="../truckBackground.png"></img>

        <div>
            <button>Request Pickup/Delivery</button>
        </div>
    </Typography>
    )
}