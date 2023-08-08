import React from "react";
import { getRequestsByDate } from "../actions";
import dayjs from "dayjs";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

function RequestList() {
  const result = getRequestsByDate(dayjs("2023-07-01"), dayjs("2023-08-09"));

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
            <TableCell>Trailer Number</TableCell>
            <TableCell>Driver Phone Number</TableCell>
            <TableCell>Dock Number</TableCell>
            <TableCell>Check-in Time</TableCell>
            <TableCell>Docked Time</TableCell>
            <TableCell>Completed Time</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.data.map((request) => (
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
              <TableCell>{request.trailer_number}</TableCell>
              <TableCell>{request.driver_phone_number}</TableCell>
              <TableCell>{request.dock_number}</TableCell>
              <TableCell>{request.check_in_time}</TableCell>
              <TableCell>{request.docked_time}</TableCell>
              <TableCell>{request.completed_time}</TableCell>
              <TableCell>{request.active ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default RequestList;
