import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Home from "./pages/Home";
import LocationSearch from "./pages/LocationSearch";
import LocationMap from "./pages/LocationMapClean";
import Profile from "./pages/Profile";
import OrderDetail from "./pages/OrderDetail";
import BookingResult from "./pages/BookingResult";
import MembershipLevels from "./pages/MembershipLevels";

function SettlementRouteRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;
  return (
    <Navigate
      to={`/orders/${encodeURIComponent(id)}?status=ongoing`}
      replace
      state={{ openSettlement: true }}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/location/search" element={<LocationSearch />} />
      <Route path="/location/map" element={<LocationMap />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/membership-levels" element={<MembershipLevels />} />
      <Route path="/orders/:id" element={<OrderDetail />} />
      <Route path="/orders/:id/settlement" element={<SettlementRouteRedirect />} />
      <Route path="/booking/result" element={<BookingResult />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

