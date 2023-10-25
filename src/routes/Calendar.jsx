import React, { useState, useEffect } from 'react';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import dayjs from 'dayjs'
import "react-big-calendar/lib/css/react-big-calendar.css";
import DateSelector from "../components/DateSelector";
import { getRequestsByDate } from '../actions';



//const MyCalendar = () => {} 
//That is the declaration for a JavaScript function. You need...

export default function MyCalendar() { // React component function
  const localizer = dayjsLocalizer(dayjs);
  
  const [startDate, setStartDate] = React.useState(dayjs());
  const [endDate, setEndDate] = React.useState(dayjs().subtract(1, "month"))
  const result = getRequestsByDate(startDate, endDate);
  if(!result) return null;
  if(result.isLoading) return <div>Loading...</div>;
  if(result.isError) return <div>Error: {result.error.message}</div>;

  let i = 0;
  let event = ([])
  console.log("Request data response: ", result.data);
  
  for (const request of result.data){ // map each result row to an event
    event[i] = {
      title: request.po_number,
      start: dayjs(request.date_time),
      end: dayjs(request.date_time),
      id: request.id,
    };
    ++i;
  };
  return (
    <div>
      <Calendar
        events={event}
        localizer={localizer}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '500px' }}
      />
    </div>
  );
}


