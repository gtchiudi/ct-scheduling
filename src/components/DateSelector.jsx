import React, { useState, useEffect } from "react";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

const DateSelector = ({ onDateChange }) => {
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
    console.log("Selected Start Date:", selectedStartDate);
  };

  const handleEndDateChange = (date) => {
    const dayjsDate = dayjs(date);
    setSelectedEndDate(dayjsDate);
    onDateChange(selectedStartDate, selectedEndDate);
    console.log("Selected End Date:", selectedEndDate);
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
};

export default DateSelector;