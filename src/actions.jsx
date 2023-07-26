import React from "react";
import { useQuery } from "@tanstack/react-query";

export function getRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => fetch("/api/request").then((res) => res.json()),
  });
}

export function getPendingRequests() {
  return useQuery({
    queryKey: ["requests", "pending"],
    queryFn: async () =>
      fetch("/api/request?approved=false").then((res) => res.json()),
  });
}

export function getApprovedRequests() {
  return useQuery({
    queryKey: ["requests", "approved"],
    queryFn: async () =>
      fetch("/api/request?approved=true").then((res) => res.json()),
  });
}

export function getRequestsByDate(startDate, endDate) {
  return useQuery({
    queryKey: ["requests", "date", startDate, endDate],
    queryFn: async () =>
      fetch(
        "/api/request?approved=true&date_time=" + startDate + "," + endDate
      ).then((res) => res.json()),
  });
}
