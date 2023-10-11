import React from "react";
import { getRequestsByDate } from "../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

function ResultDisplay({ startDate, endDate }) {
  const result = getRequestsByDate(startDate, endDate);
  if (!result) return null;
  if (result.isLoading) return <div>Loading...</div>;
  if (result.isError) return <div>Error: {result.error.message}</div>;

  return (
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
  );
}

export default ResultDisplay;
