import { EventSubscriptionService, SocketLike } from "../../src/services/EventSubscriptionService";

function fakeSocket(): SocketLike & { messages: string[] } {
  const messages: string[] = [];
  return {
    readyState: 1, // OPEN
    messages,
    send(data: string) {
      messages.push(data);
    },
  };
}

describe("EventSubscriptionService", () => {
  it("delivers an event to a template subscriber for a contract registered after the subscription started (DL-3.4)", () => {
    const events = new EventSubscriptionService();
    const client = fakeSocket();
    events.subscribe(client, "template", "ERC3643Token");

    // The contract's template only becomes known now, after subscribe() ran.
    events.broadcast({
      contractName: "token",
      address: "0xTokenAddress",
      template: "ERC3643Token",
      eventName: "Transfer",
      blockNumber: 42,
      args: { from: "0xA", to: "0xB", value: "50" },
    });

    expect(client.messages).toHaveLength(1);
    const parsed = JSON.parse(client.messages[0]);
    expect(parsed.event_name).toBe("Transfer");
    expect(parsed.contract_address).toBe("0xTokenAddress");
    expect(parsed.block_number).toBe(42);
    expect(parsed.args).toEqual({ from: "0xA", to: "0xB", value: "50" });
  });

  it("an address-filtered subscriber does not receive events from other contracts", () => {
    const events = new EventSubscriptionService();
    const client = fakeSocket();
    events.subscribe(client, "address", "0xTokenAddress");

    events.broadcast({
      contractName: "otherContract",
      address: "0xOtherAddress",
      template: "ERC3643Token",
      eventName: "Transfer",
      blockNumber: 1,
      args: {},
    });

    expect(client.messages).toHaveLength(0);
  });

  it("a template subscriber never receives events from a contract registered without a template", () => {
    const events = new EventSubscriptionService();
    const client = fakeSocket();
    events.subscribe(client, "template", "ERC3643Token");

    events.broadcast({
      contractName: "token",
      address: "0xTokenAddress",
      template: null,
      eventName: "Transfer",
      blockNumber: 1,
      args: {},
    });

    expect(client.messages).toHaveLength(0);
  });

  it("does not push to a client after it unsubscribes", () => {
    const events = new EventSubscriptionService();
    const client = fakeSocket();
    events.subscribe(client, "address", "0xTokenAddress");
    events.unsubscribe(client);

    events.broadcast({
      contractName: "token",
      address: "0xTokenAddress",
      template: null,
      eventName: "Transfer",
      blockNumber: 1,
      args: {},
    });

    expect(client.messages).toHaveLength(0);
  });
});
