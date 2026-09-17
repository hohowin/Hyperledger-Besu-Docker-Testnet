import { ExplorerProxy, ExplorerError } from "../../src/services/ExplorerProxy";

const NODE_URLS = { anson: "http://besu-rpc-anson:8545", beatrice: "http://besu-rpc-beatrice:8545" };

function mockFetchJsonRpc(responder: (url: string, method: string, params: unknown[]) => unknown) {
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
    const result = responder(String(url), body.method, body.params);
    return {
      json: async () => ({ result }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("ExplorerProxy — allowlist (Phase 4 anti-gate)", () => {
  it("rejects an arbitrary node value instead of passing it through as a URL", async () => {
    const explorer = new ExplorerProxy(NODE_URLS);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(explorer.listBlocks("http://evil.example")).rejects.toMatchObject({ status: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing node value", async () => {
    const explorer = new ExplorerProxy(NODE_URLS);
    await expect(explorer.listBlocks(undefined)).rejects.toBeInstanceOf(ExplorerError);
  });

  it("resolves anson/beatrice to their fixed internal URLs, never the caller's string", async () => {
    const calledUrls: string[] = [];
    mockFetchJsonRpc((url) => {
      calledUrls.push(url);
      return "0x5";
    });
    const explorer = new ExplorerProxy(NODE_URLS);

    await explorer.listBlocks("anson", 1);
    await explorer.listBlocks("beatrice", 1);

    expect(calledUrls.every((u) => u === NODE_URLS.anson || u === NODE_URLS.beatrice)).toBe(true);
  });
});

describe("ExplorerProxy — reads", () => {
  it("lists the requested number of most recent blocks", async () => {
    mockFetchJsonRpc((_url, method, params) => {
      if (method === "eth_blockNumber") return "0x64"; // 100
      if (method === "eth_getBlockByNumber") return { number: params[0], transactions: [] };
      return null;
    });
    const explorer = new ExplorerProxy(NODE_URLS);

    const blocks = await explorer.listBlocks("anson", 3);
    expect(blocks).toEqual([{ number: "0x64", transactions: [] }, { number: "0x63", transactions: [] }, { number: "0x62", transactions: [] }]);
  });

  it("throws a 404 ExplorerError when a block is not found", async () => {
    mockFetchJsonRpc(() => null);
    const explorer = new ExplorerProxy(NODE_URLS);

    await expect(explorer.getBlock("anson", "999999")).rejects.toMatchObject({ status: 404 });
  });

  it("merges the receipt into the transaction result", async () => {
    mockFetchJsonRpc((_url, method) => {
      if (method === "eth_getTransactionByHash") return { hash: "0xabc", from: "0x1" };
      if (method === "eth_getTransactionReceipt") return { status: "0x1" };
      return null;
    });
    const explorer = new ExplorerProxy(NODE_URLS);

    await expect(explorer.getTransaction("anson", "0xabc")).resolves.toEqual({
      hash: "0xabc",
      from: "0x1",
      receipt: { status: "0x1" },
    });
  });
});
