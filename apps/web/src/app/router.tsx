import { createBrowserRouter, Navigate } from "react-router-dom";
import MainPage from "../pages/MainPage";
import TodayDetailPage from "../pages/TodayDetailPage";
import MonthDetailPage from "../pages/MonthDetailPage";
import CalendarPage from "../pages/CalendarPage";
import SettingsPage from "../pages/SettingsPage";

export const router = createBrowserRouter([
  { path: "/", element: <MainPage /> },
  { path: "/today/:day", element: <TodayDetailPage /> },
  { path: "/month/:month", element: <MonthDetailPage /> },
  { path: "/calendar/:month", element: <CalendarPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "*", element: <Navigate to="/" replace /> }
]);
