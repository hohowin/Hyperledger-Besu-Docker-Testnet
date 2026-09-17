export interface ChainEventMessage {
  event_name: string;
  contract_address: string;
  block_number: number;
  args: Record<string, unknown>;
}

const WS_URL = (import.meta.env.VITE_MOCK_MIDDLEWARE_WS_URL as string | undefined) ?? "ws://localhost:5001";

/// D-10: the only place the browser talks to mock-middleware directly — a
/// read-only event relay, never REST (architecture table: frontend <->
/// mock-middleware is WebSocket-only). Subscribes by contract *template*
/// rather than a specific address, so the frontend never needs to know
/// deployed-addresses.json.
export function subscribeToTokenEvents(onEvent: (event: ChainEventMessage) => void): () => void {
  const ws = new WebSocket(WS_URL);
  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ filter: "template", value: "ERC3643Token" }));
  });
  ws.addEventListener("message", (msg) => {
    try {
      onEvent(JSON.parse(msg.data as string) as ChainEventMessage);
    } catch {
      // malformed message — best-effort relay, ignore
    }
  });
  return () => ws.close();
}
