import React from "react";
import DateSelector from "../components/DateSelector";
import ResultDisplay from "../components/ResultDisplay";
import Button from "@mui/material/Button";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { access_token as accessTokenAtom } from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";

const RequestList = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = React.useState(dayjs());
  const [endDate, setEndDate] = React.useState(dayjs());
  const [submitted, setSubmitted] = React.useState(false);
  const [access_token] = useAtom(accessTokenAtom);

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setSubmitted(false);
  };
  console.log(access_token);
  React.useEffect(() => {
    if (access_token === null) {
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
