import React from "react";
import { getRequestsByDate } from "../actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

function ResultDisplay({ startDate, endDate }) {
  if (!dayjs.isDayjs(startDate) || !dayjs.isDayjs(endDate)) {
    throw new Error("Both startDate and endDate must be Day.js date objects.");
  }

  const formattedStartDate = startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  const formattedEndDate = endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  const queryClient = useQueryClient();
  let pauseQuery = true;
  const navigate = useNavigate();

  const result = useQuery({
    queryKey: ["requests", "date", startDate, endDate, "active"],
    queryFn: getRequestsByDate(formattedStartDate, formattedEndDate),
    enabled: pauseQuery,
    onError: (error) => {
      if (error.response.status === 401) {
        // Check if token refresh is already in progress
        pauseQuery = true;
        if (!refresh) {
          setRefresh(true);
          authorized = isAuth();

          if (!authorized) {
            queryClient.cancelQueries(["requests", "date", startDate, endDate]);
            navigate("/logout");
          }
        }
        pauseQuery = false;
        queryClient.invalidateQueries(["requests", "date", startDate, endDate]);
      }
    },
  });
  if (result.isSuccess) {
    console.log(result.data.data);
  }

  return (
    <div>
      {result.isLoading && (
        <div>
          <br />
          <Typography textAlign="center" variant="h2">
            Loading...
          </Typography>
        </div>
      )}
      {result.isError && (
        <div>
          <br />
          <Typography textAlign="center" variant="h2">
            Error: {result.error.message}
          </Typography>
        </div>
      )}
      {result.isSuccess && result.data.data.length === 0 && (
        <div>
          <br />
          <Typography textAlign="center" variant="h2">
            No Results
          </Typography>
        </div>
      )}
      {result.isSuccess && result.data.data.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Approved</TableCell>
                <TableCell>Company Name</TableCell>
                <TableCell>Phone Number</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>PO Number</TableCell>
                <TableCell>Load Type</TableCell>
                <TableCell>Container Number</TableCell>
                <TableCell>Note Section</TableCell>
                <TableCell>Date Time</TableCell>
                <TableCell>Delivery</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(result.data.data) ? (
                result.data.data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.approved ? "Yes" : "No"}</TableCell>
                    <TableCell>{request.company_name}</TableCell>
                    <TableCell>{request.phone_number}</TableCell>
                    <TableCell>{request.email}</TableCell>
                    <TableCell>{request.po_number}</TableCell>
                    <TableCell>{request.load_type}</TableCell>
                    <TableCell>{request.container_number}</TableCell>
                    <TableCell>{request.note_section}</TableCell>
                    <TableCell>{request.date_time}</TableCell>
                    <TableCell>{request.delivery ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <h>Error: Data is not an Array</h>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

export default ResultDisplay;
