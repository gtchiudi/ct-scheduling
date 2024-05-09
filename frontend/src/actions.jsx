import React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";

export function getRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const response = await axios.get("/api/request");
      return response;
    },
  });
}

export async function getPendingRequests() {
  const response = await axios.get("/api/request", {
    params: {
      approved: "False",
    },
  });
  return response;
}

export async function fetchWarehouseData() {
  try {
    const response = await axios.get("/api/warehouse");
    return response.data;
  } catch (error) {
    throw error;
  }
}

export function getApprovedRequests() {
  return useQuery({
    queryKey: ["requests", "approved"],
    queryFn: async () => {
      const response = await axios.get("/api/request", {
        params: {
          approved: "true",
        },
      });
      return response;
    },
  });
}

export async function getRequestsByDate(formattedStartDate, formattedEndDate) {
  return await axios.get("/api/request", {
    params: {
      approved: "True",
      active: "True",
      start_date: formattedStartDate,
      end_date: formattedEndDate,
    },
  });
}

export function getUserData() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await axios.get("/api/user");
      return response;
    },
  });
}

export async function submitUserData(user) {
  const response = await axios.post("/token/", user, {
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true,
  });
  if (!response.data.access) {
    throw new Error("Network response was not ok");
  }
  user.username = "";
  user.password = "";
  return response.data;
}

export async function getSchedule() {
  const response = await axios.get("/api/schedule", {});
  return response;
}
