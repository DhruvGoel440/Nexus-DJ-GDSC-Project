import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { EngineProvider } from "./context/EngineContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <EngineProvider>
        <App />
      </EngineProvider>
    </ToastProvider>
  </React.StrictMode>
);