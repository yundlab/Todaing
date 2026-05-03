import { createBrowserRouter, Navigate } from "react-router-dom";
import Main from "@/routes/Main";
import TodayDetail from "@/routes/TodayDetail";
import MonthDetail from "@/routes/MonthDetail";
import Calendar from "@/routes/Calendar";
import Settings from "@/routes/Settings";

export const router = createBrowserRouter([
  { path: "/", element: <Main /> },
  { path: "/today/:day", element: <TodayDetail /> },
  { path: "/month/:month", element: <MonthDetail /> },
  { path: "/calendar/:month", element: <Calendar /> },
  { path: "/settings", element: <Settings /> },
  { path: "*", element: <Navigate to="/" replace /> }
]);
