import React from "react";
import { useQuery } from "@tanstack/react-query";

export function getRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => fetch("/api/request").then((res) => res.json()),
  });
}
