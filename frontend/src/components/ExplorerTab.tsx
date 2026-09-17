import { useCallback, useEffect, useState } from "react";
import { ApiClient, ApiError } from "../api/ApiClient";
import { subscribeToTokenEvents } from "../api/eventFeed";
import type { ChainEventMessage } from "../api/eventFeed";
import { usePendingTransfers } from "../state/PendingTransfers";

type NodeName = "anson" | "beatrice";

interface BlockSummary {
  number: string;
  hash: string;
  timestamp: string;
  transactions: string[];
}

interface BlockDetail {
  number: string;
  hash: string;
  timestamp: string;
  transactions: { hash: string }[];
}

interface TxDetail {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  receipt: { status: string } | null;
}

const NODES: { id: NodeName; label: string }[] = [
  { id: "anson", label: "Anson" },
  { id: "beatrice", label: "Beatrice" },
];

/// DL-5.3: block/tx browser with a View-as switch (D-11 — Explorer reads
/// both RPC nodes independently, so switching proves they agree, within
/// 1 block), plus the pending-transfers panel (state lifted in App.tsx so
/// it survives switching away from the Transfer tab) and a live feed off
/// mock-middleware's WebSocket relay (D-10).
export function ExplorerTab() {
  const [viewAs, setViewAs] = useState<NodeName>("anson");
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null);
  const [selectedTx, setSelectedTx] = useState<TxDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<ChainEventMessage[]>([]);
  const { pending } = usePendingTransfers();

  const refreshBlocks = useCallback(async (node: NodeName) => {
    setMessage(null);
    try {
      setBlocks(await ApiClient.listBlocks(node));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "failed to load blocks");
    }
  }, []);

  useEffect(() => {
    setSelectedBlock(null);
    setSelectedTx(null);
    refreshBlocks(viewAs);
  }, [viewAs, refreshBlocks]);

  useEffect(() => {
    const unsubscribe = subscribeToTokenEvents((event) => {
      setLiveEvents((prev) => [event, ...prev].slice(0, 10));
    });
    return unsubscribe;
  }, []);

  async function openBlock(number: string) {
    setSelectedTx(null);
    setMessage(null);
    try {
      setSelectedBlock(await ApiClient.getBlock(viewAs, number));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "failed to load block");
    }
  }

  async function openTx(hash: string) {
    setMessage(null);
    try {
      setSelectedTx(await ApiClient.getTransaction(viewAs, hash));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "failed to load transaction");
    }
  }

  const latestBlock = blocks[0] ? parseInt(blocks[0].number, 16) : null;

  return (
    <section aria-label="Explorer">
      <div className="card">
        <label>
          View as
          <select value={viewAs} onChange={(e) => setViewAs(e.target.value as NodeName)} aria-label="View as">
            {NODES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {latestBlock !== null && <p data-testid="explorer-latest-block">Latest block: {latestBlock}</p>}
        {message && (
          <p role="status" className="message error">
            {message}
          </p>
        )}
      </div>

      <div className="card">
        <h3>Pending transactions</h3>
        <ul className="pending-list" data-testid="pending-panel">
          {pending.length === 0 ? <li>None in flight</li> : pending.map((p) => <li key={p.id}>{p.label}</li>)}
        </ul>
      </div>

      <div className="card">
        <h3>Recent blocks</h3>
        <table className="clickable" data-testid="block-list">
          <thead>
            <tr>
              <th>Number</th>
              <th>Hash</th>
              <th>Tx count</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.hash} onClick={() => openBlock(block.number)}>
                <td>{parseInt(block.number, 16)}</td>
                <td title={block.hash}>{block.hash.slice(0, 12)}…</td>
                <td>{block.transactions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBlock && (
        <div className="card" data-testid="block-detail">
          <h3>Block {parseInt(selectedBlock.number, 16)}</h3>
          {selectedBlock.transactions.length === 0 ? (
            <p>No transactions in this block.</p>
          ) : (
            <table className="clickable">
              <thead>
                <tr>
                  <th>Tx hash</th>
                </tr>
              </thead>
              <tbody>
                {selectedBlock.transactions.map((tx) => (
                  <tr key={tx.hash} onClick={() => openTx(tx.hash)}>
                    <td>{tx.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedTx && (
        <div className="card" data-testid="tx-detail">
          <h3>Transaction</h3>
          <p>
            <strong>Hash:</strong> {selectedTx.hash}
          </p>
          <p>
            <strong>From:</strong> {selectedTx.from}
          </p>
          <p>
            <strong>To:</strong> {selectedTx.to ?? "(contract creation)"}
          </p>
          <p>
            <strong>Status:</strong> {selectedTx.receipt?.status === "0x1" ? "success" : "failed"}
          </p>
        </div>
      )}

      <div className="card">
        <h3>Live events</h3>
        <ul className="pending-list" data-testid="live-events">
          {liveEvents.length === 0 ? (
            <li>Waiting for events…</li>
          ) : (
            liveEvents.map((event, i) => (
              <li key={i}>
                {event.event_name} @ block {event.block_number}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
