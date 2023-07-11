import React from 'react';
import Calendar from "@ericz1803/react-google-calendar";

const API_KEY = "AIzaSyAYQCOmfhiIRMgFUAzKRPcuixVCaoCeM5M";
let calendars = [
    {calendarId: "candordev01@gmail.com"},
];

class GoogleCalendar extends React.Component {
    render() {
        return (
            <div>
                <Calendar apiKey={API_KEY} calendars={calendars} />
            </div>
        );
    }
}

export default GoogleCalendar;