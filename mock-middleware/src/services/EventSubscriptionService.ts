export interface ChainEvent {
  contractName: string;
  address: string;
  template: string | null;
  eventName: string;
  blockNumber: number;
  args: Record<string, unknown>;
}

/// Deliberately not typed against `ws`'s WebSocket — the transport is an
/// implementation detail (D-10 rejected webhook delivery only for MVP
/// convenience, not because WS is load-bearing here). Any object with these
/// three members can be a subscriber, which keeps this service trivially
/// unit-testable without a real socket.
export interface SocketLike {
  readyState: number;
  send(data: string): void;
}

const OPEN = 1; // matches ws.WebSocket.OPEN / browser WebSocket.OPEN

type Filter = "address" | "template";

/// D-10: WebSocket push, filterable by contract address or by contract
/// template (ABI/contract-type label). Best-effort, at-most-once — no replay
/// buffer on reconnect (architecture.md §4/§7 R2/R10): the chain's own event
/// log is the durable source, this is a convenience relay on top of it.
export class EventSubscriptionService {
  private readonly subscriptions = new Map<SocketLike, { filter: Filter; value: string }>();

  subscribe(client: SocketLike, filter: Filter, value: string): void {
    this.subscriptions.set(client, { filter, value });
  }

  unsubscribe(client: SocketLike): void {
    this.subscriptions.delete(client);
  }

  broadcast(event: ChainEvent): void {
    const message = JSON.stringify({
      event_name: event.eventName,
      contract_address: event.address,
      block_number: event.blockNumber,
      args: event.args,
    });

    for (const [client, sub] of this.subscriptions) {
      const matches =
        (sub.filter === "address" && sub.value.toLowerCase() === event.address.toLowerCase()) ||
        (sub.filter === "template" && event.template !== null && sub.value === event.template);
      if (matches && client.readyState === OPEN) {
        client.send(message);
      }
    }
  }
}
