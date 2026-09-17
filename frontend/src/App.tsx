import { useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { TransferDashboard } from "./components/TransferDashboard";
import { ExplorerTab } from "./components/ExplorerTab";
import { PendingTransfersProvider } from "./state/PendingTransfers";
import "./App.css";

type Tab = "admin" | "transfer" | "explorer";

export function App() {
  const [tab, setTab] = useState<Tab>("admin");

  return (
    <PendingTransfersProvider>
      <main>
        <h1>Hyperledger-Besu-Docker-Testnet</h1>
        <nav className="tabs">
          <button type="button" className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            Admin
          </button>
          <button type="button" className={tab === "transfer" ? "active" : ""} onClick={() => setTab("transfer")}>
            Transfer
          </button>
          <button type="button" className={tab === "explorer" ? "active" : ""} onClick={() => setTab("explorer")}>
            Explorer
          </button>
        </nav>
        {tab === "admin" && <AdminPanel />}
        {tab === "transfer" && <TransferDashboard />}
        {tab === "explorer" && <ExplorerTab />}
      </main>
    </PendingTransfersProvider>
  );
}

export default App;
