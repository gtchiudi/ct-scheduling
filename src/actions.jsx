import React from "react";
import { useQuery } from "@tanstack/react-query";

export function getRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => fetch("/api/request").then((res) => res.json()),
  });
}

export function getPendingRequests() {
  const filterParams = {
    approved: "false",
  };
  return useQuery({
    queryKey: ["requests", "pending"],
    queryFn: async () =>
      fetch("/api/request/?approved=False").then((res) => res.json()),
  });
}

export function getApprovedRequests() {
  return useQuery({
    queryKey: ["requests", "approved"],
    queryFn: async () =>
      fetch("/api/request/?approved=True").then((res) => res.json()),
  });
}

export function getRequestsByDate(startDate, endDate) {
  const formattedStartDate = startDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  const formattedEndDate = endDate.format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]");
  return useQuery({
    queryKey: ["requests", "date", startDate, endDate],
    queryFn: async () =>
      fetch(
        `/api/request/?approved=True&start_date=${formattedStartDate}&end_date=${formattedEndDate}`
      ).then((res) => res.json()),
  });
}
