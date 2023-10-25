import React from "react";
import DateSelector from "../components/DateSelector";
import ResultDisplay from "../components/ResultDisplay";
import Button from "@mui/material/Button";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { isAuthAtom } from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";

const RequestList = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = React.useState(dayjs());
  const [endDate, setEndDate] = React.useState(dayjs());
  const [submitted, setSubmitted] = React.useState(false);
  const [isAuth] = useAtom(isAuthAtom);

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setSubmitted(false);
  };
  React.useEffect(() => {
    if (isAuth === false) {
      navigate("/login");
    }
  });

  return (
    <div>
      <br />
      <DateSelector onDateChange={handleDateChange} />
      <Button variant="contained" color="primary" onClick={setSubmitted}>
        Submit
      </Button>
      {submitted && <ResultDisplay startDate={startDate} endDate={endDate} />}
    </div>
  );
};

export default RequestList;
