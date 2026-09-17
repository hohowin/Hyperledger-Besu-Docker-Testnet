import { useState } from "react";
import { ApiClient, ApiError } from "../api/ApiClient";
import type { Identity } from "../api/ApiClient";

const ONBOARDABLE: { id: Identity; label: string }[] = [
  { id: "anson", label: "Anson" },
  { id: "beatrice", label: "Beatrice" },
];

interface IdentityState {
  message: string | null;
  isError: boolean;
  busy: boolean;
  mintAmount: string;
  balance: number | null;
}

const initialState: IdentityState = { message: null, isError: false, busy: false, mintAmount: "", balance: null };

/// Admin onboards identities without touching the CLI (DL-4.1, US-009):
/// register -> issue claim -> mint, one card per demo identity. Plus two
/// Phase 3/mock-middleware capabilities made reachable from the UI (DL-5.1):
/// uploading a new contract ABI, and proving the idempotent-retry guarantee.
export function AdminPanel() {
  const [state, setState] = useState<Record<Identity, IdentityState>>({
    admin: { ...initialState },
    anson: { ...initialState },
    beatrice: { ...initialState },
  });

  function patch(id: Identity, patchValue: Partial<IdentityState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patchValue } }));
  }

  async function run(id: Identity, action: () => Promise<{ message: string; balance?: number }>) {
    patch(id, { busy: true, message: null, isError: false });
    try {
      const { message, balance } = await action();
      patch(id, { busy: false, message, isError: false, ...(balance !== undefined ? { balance } : {}) });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unexpected error — check the backend is running";
      patch(id, { busy: false, message, isError: true });
    }
  }

  return (
    <section aria-label="Admin panel">
      {ONBOARDABLE.map(({ id, label }) => {
        const identityState = state[id];
        return (
          <div key={id} className="card" data-testid={`admin-card-${id}`}>
            <h3>{label}</h3>
            <div className="button-row">
              <button type="button" disabled={identityState.busy} onClick={() => run(id, async () => ({ message: (await ApiClient.registerIdentity(id)).status }))}>
                Register {label}
              </button>
              <button type="button" disabled={identityState.busy} onClick={() => run(id, async () => ({ message: (await ApiClient.issueClaim(id)).status }))}>
                Issue Claim
              </button>
            </div>
            <div className="button-row">
              <input
                type="number"
                min={1}
                placeholder="Amount"
                value={identityState.mintAmount}
                onChange={(e) => patch(id, { mintAmount: e.target.value })}
                aria-label={`Mint amount for ${label}`}
              />
              <button
                type="button"
                disabled={identityState.busy || !identityState.mintAmount}
                onClick={() =>
                  run(id, async () => {
                    const result = await ApiClient.mint(id, Number(identityState.mintAmount));
                    return { message: result.status, balance: result.balance };
                  })
                }
              >
                Mint
              </button>
            </div>
            {identityState.balance !== null && <p className="balance">Balance: {identityState.balance} COIN</p>}
            {identityState.message && (
              <p role="status" className={identityState.isError ? "message error" : "message success"}>
                {identityState.isError ? identityState.message : `${identityState.message}`}
              </p>
            )}
          </div>
        );
      })}
      <UploadContractForm />
      <IdempotentRetryDebugPanel />
    </section>
  );
}

/// DL-5.1: registers a new contract's ABI with mock-middleware (proxied
/// through backend-api, US-004/D-07) without touching the CLI.
function UploadContractForm() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [abiText, setAbiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleUpload() {
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const abi = JSON.parse(abiText) as unknown[];
      if (!Array.isArray(abi)) throw new Error("ABI must be a JSON array");
      await ApiClient.uploadContract(name, address, abi, "ERC3643Token");
      setMessage("uploaded");
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" data-testid="upload-contract-form">
      <h3>Upload Contract</h3>
      <label>
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Contract name" />
      </label>
      <label>
        Address
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Contract address" />
      </label>
      <label>
        ABI (JSON array)
        <textarea rows={4} value={abiText} onChange={(e) => setAbiText(e.target.value)} aria-label="Contract ABI" />
      </label>
      <button type="button" disabled={busy || !name || !address || !abiText} onClick={handleUpload}>
        Upload
      </button>
      {message && (
        <p role="status" className={isError ? "message error" : "message success"}>
          {message}
        </p>
      )}
    </div>
  );
}

/// DL-5.2/idempotent-retry.spec.ts: reuses the same requestId across clicks
/// so posting it twice proves mock-middleware's Idempotency-Key dedup (D-08)
/// end to end — the second click returns the same tx id and mints nothing new.
function IdempotentRetryDebugPanel() {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSend() {
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const result = await ApiClient.mintWithKey("anson", 1, requestId);
      setLastId(result.id);
      setMessage(result.status);
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof ApiError ? err.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" data-testid="idempotent-retry-panel">
      <h3>Debug: Idempotent Retry</h3>
      <p>Mints 1 COIN to Anson using the same request id every click — retrying never double-mints.</p>
      <button type="button" disabled={busy} onClick={handleSend}>
        Send Mint (debug)
      </button>
      {lastId && <p data-testid="idempotent-retry-id">tx: {lastId}</p>}
      {message && (
        <p role="status" className={isError ? "message error" : "message success"}>
          {message}
        </p>
      )}
    </div>
  );
}
