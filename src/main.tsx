import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { UserSessionProvider } from "./contexts/UserSessionContext";
import { hydrateOrdersUserFromStorage } from "./services/ordersStore";
import "./index.css";

hydrateOrdersUserFromStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UserSessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UserSessionProvider>
  </React.StrictMode>,
);

