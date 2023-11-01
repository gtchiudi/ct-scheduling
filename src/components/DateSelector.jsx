import React, { useState, useEffect } from "react";
import { DatePicker, TimePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

export default function DateSelector({ onDateChange }) {
  const today = dayjs();

  const [selectedStartDate, setSelectedStartDate] = useState(today);
  const [selectedEndDate, setSelectedEndDate] = useState(today);

  useEffect(() => {
    // Call onDateChange with initial today's date values
    onDateChange(selectedStartDate, selectedEndDate);
  }, [selectedEndDate, selectedStartDate]);

  const handleStartDateChange = (date) => {
    const dayjsDate = dayjs(date);
    setSelectedStartDate(dayjsDate);
    onDateChange(selectedStartDate, selectedEndDate);
    //console.log("Selected Start Date:", selectedStartDate);
  };

  const handleEndDateChange = (date) => {
    const dayjsDate = dayjs(date);
    setSelectedEndDate(dayjsDate);
    onDateChange(selectedStartDate, selectedEndDate);
    //console.log("Selected End Date:", selectedEndDate);
  };

  return (
    <div>
      <DatePicker
        label="Start Date"
        value={selectedStartDate}
        onChange={(newValue) => handleStartDateChange(newValue)}
        //defaultDate={selectedStartDate} // Set today's date as the default for the start date picker
      />

      <DatePicker
        label="End Date"
        value={selectedEndDate}
        onChange={(newValue) => handleEndDateChange(newValue)}
        defaultDate={selectedEndDate} // Set today's date as the default for the end date picker
      />
    </div>
  );
}

export const SingleDateSelector = ({ onDateChange }) => {
  const today = dayjs();

  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    // Call onDateChange with initial today's date values
    onDateChange(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (date) => {
    const dayjsDate = dayjs(date);
    setSelectedDate(dayjsDate);
    onDateChange(selectedDate);
    //console.log("Selected Date:", selectedDate);
  };

  return (
    <div>
      <DatePicker
        label="Select Date"
        value={selectedDate}
        onChange={(newValue) => handleDateChange(newValue)}
        disablePast
        //defaultDate={selectedStartDate} // Set today's date as the default for the start date picker
      />
    </div>
  );
};

export const TimeSelector = ({ onTimeChange }) => {
  const now = dayjs().startOf("day");
  const [selectedTime, setSelectedTime] = useState(now);

  useEffect(() => {
    // Call onDateChange with initial today's date values
    onTimeChange(selectedTime);
  }, [selectedTime]);

  const handleTimeChange = (time) => {
    const dayjsTime = dayjs(time);
    setSelectedTime(dayjsTime);
    onTimeChange(selectedTime);
    //console.log("Selected Time:", selectedTime);
  };

  console.log(now);

  return (
    <div>
      <TimePicker
        label="Select Time"
        //value={now.format('hh:mm aa')}
        onChange={(e) => handleTimeChange(e)}
        // shouldDisableTime -- takes function
        // will be used to only allow selection of available times
      />
    </div>
  );
};
