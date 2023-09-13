import React from "react";
import DateSelector from "../components/DateSelector";
import ResultDisplay from "../components/ResultDisplay";
import Button from "@mui/material/Button";
import dayjs from "dayjs";
//import { useHistory } from "react-router-dom";

/*const handleSubmit = () => {
  history.push(`/result?start=${startDate.format()}&end=${endDate.format()}`);
};
const history = useHistory();
*/
const RequestList = () => {
  const [startDate, setStartDate] = React.useState(dayjs());
  const [endDate, setEndDate] = React.useState(dayjs());
  const [submitted, setSubmitted] = React.useState(false);

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setSubmitted(false);
  };

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
