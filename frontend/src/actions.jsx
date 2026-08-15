import axios from "axios";

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
