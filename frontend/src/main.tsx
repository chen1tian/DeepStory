import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// global.css imported via App

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
