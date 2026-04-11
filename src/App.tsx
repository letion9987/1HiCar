import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import LocationSearch from "./pages/LocationSearch";
import LocationMap from "./pages/LocationMap";
import Profile from "./pages/Profile";
import OrderDetail from "./pages/OrderDetail";
import BookingResult from "./pages/BookingResult";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/location/search" element={<LocationSearch />} />
      <Route path="/location/map" element={<LocationMap />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/orders/:id" element={<OrderDetail />} />
      <Route path="/booking/result" element={<BookingResult />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

