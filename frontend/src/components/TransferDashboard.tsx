import { useEffect, useState } from "react";
import { ApiClient, ApiError } from "../api/ApiClient";
import type { Identity, TransferRecord } from "../api/ApiClient";
import { usePendingTransfers } from "../state/PendingTransfers";

const ACTORS: { id: Identity; label: string }[] = [
  { id: "anson", label: "Anson" },
  { id: "beatrice", label: "Beatrice" },
];

// Admin is a valid recipient option (D-07: demo-mode identity switch, three
// fixed identities only) but is never onboarded as a token holder in the
// Admin panel flow — sending to Admin is how this dashboard demonstrates the
// compliance-rejection path (US-011) without inventing an arbitrary address.
const RECIPIENTS: { id: Identity; label: string }[] = [...ACTORS, { id: "admin", label: "Admin (unverified)" }];

/// Anson/Beatrice switch identity, see their live balance, send COIN, and
/// view history — including the compliance-rejection error path (DL-4.2).
export function TransferDashboard() {
  const [actingAs, setActingAs] = useState<Identity>("anson");
  const [recipient, setRecipient] = useState<Identity>("beatrice");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const { begin, settle } = usePendingTransfers();

  async function refreshBalance(who: Identity) {
    const result = await ApiClient.getBalance(who);
    setBalance(result.balance);
  }

  async function refreshHistory() {
    setHistory(await ApiClient.getTransfers());
  }

  useEffect(() => {
    refreshBalance(actingAs).catch(() => setBalance(null));
    // Default the recipient to whichever known actor isn't the sender.
    setRecipient((current) => (current === actingAs ? RECIPIENTS.find((r) => r.id !== actingAs)!.id : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingAs]);

  useEffect(() => {
    refreshHistory().catch(() => setHistory([]));
  }, []);

  async function handleSend() {
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setIsError(true);
      setMessage("Amount must be a positive integer");
      return;
    }

    setBusy(true);
    setMessage(null);
    setIsError(false);
    const pendingId = begin(`${actingAs} → ${recipient}: ${parsedAmount} COIN`);
    try {
      const result = await ApiClient.transfer(actingAs, recipient, parsedAmount);
      setBalance(result.balances[actingAs] ?? null);
      setMessage("Transfer sent");
      setAmount("");
      await refreshHistory();
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Unexpected error — check the backend is running";
      setIsError(true);
      setMessage(errorMessage);
      // Balances intentionally left untouched — a rejected transfer must not
      // appear to have moved funds (DL-4.2 verification checklist).
    } finally {
      settle(pendingId);
      setBusy(false);
    }
  }

  return (
    <section aria-label="Transfer dashboard">
      <div className="card">
        <label>
          Acting as
          <select value={actingAs} onChange={(e) => setActingAs(e.target.value as Identity)}>
            {ACTORS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="balance">Balance: {balance ?? "—"} COIN</p>

        <label>
          Send to
          <select value={recipient} onChange={(e) => setRecipient(e.target.value as Identity)}>
            {RECIPIENTS.filter((r) => r.id !== actingAs).map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <input type="number" min={1} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Transfer amount" />
          <button type="button" disabled={busy || !amount} onClick={handleSend}>
            Send
          </button>
        </div>
        {message && (
          <p role="status" className={isError ? "message error" : "message success"}>
            {message}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Transfer history</h3>
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Tx</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.txHash}>
                <td>{record.from}</td>
                <td>{record.to}</td>
                <td>{record.amount}</td>
                <td title={record.txHash}>{record.txHash.slice(0, 10)}…</td>
                <td>{new Date(record.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
