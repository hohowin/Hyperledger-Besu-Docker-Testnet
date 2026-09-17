import { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { EventSubscriptionService } from "../services/EventSubscriptionService";

/// DL-3.4: a client connects, then sends {"filter":"address"|"template","value":...}
/// to subscribe. Best-effort push, no replay on reconnect (EventSubscriptionService docstring).
export function attachWebSocketServer(httpServer: Server, events: EventSubscriptionService): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (client: WebSocket) => {
    client.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { filter?: string; value?: string };
        if ((msg.filter === "address" || msg.filter === "template") && typeof msg.value === "string") {
          events.subscribe(client, msg.filter, msg.value);
        }
      } catch {
        // malformed subscription message — ignore, this is a best-effort relay
      }
    });
    client.on("close", () => events.unsubscribe(client));
  });
  return wss;
}
