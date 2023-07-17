import { DateCalendar } from "@mui/x-date-pickers";
import { Paper, Grid, Typography, Container } from "@mui/material";


const Calendar = () => {
    return (
        <Container maxWidth='sm'>
            <Paper elevation={3}>
                <DateCalendar 
                    sx={{
                        fontSize: 50,
                    }}
                    showDaysOutsideCurrentMonth
                    fixedWeekNumber={6}
                />
            </Paper>
        </Container>
        
    );
};

export default Calendar;