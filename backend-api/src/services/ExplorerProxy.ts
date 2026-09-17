export class ExplorerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ExplorerError";
  }
}

export type NodeName = "anson" | "beatrice";

function isNodeName(value: unknown): value is NodeName {
  return value === "anson" || value === "beatrice";
}

/// D-12: raw block/tx browsing bypasses mock-middleware's contract gateway
/// entirely (it isn't a contract call) and talks directly to besu-rpc-*.
/// The `node` query/path parameter is resolved through this fixed lookup —
/// never interpolated into a URL — so an arbitrary value can never reach an
/// outbound request (the Phase 4 anti-gate: this must not become an SSRF
/// proxy for arbitrary hosts).
export class ExplorerProxy {
  private readonly nodeUrls: Record<NodeName, string>;

  constructor(nodeUrls: Record<NodeName, string>) {
    this.nodeUrls = nodeUrls;
  }

  async listBlocks(node: unknown, count = 10): Promise<unknown[]> {
    const url = this.resolveUrl(node);
    const latestHex = (await this.rpc(url, "eth_blockNumber", [])) as string;
    const latest = Number(latestHex);
    const heights = Array.from({ length: Math.min(count, latest + 1) }, (_, i) => latest - i);
    return Promise.all(heights.map((height) => this.rpc(url, "eth_getBlockByNumber", [`0x${height.toString(16)}`, false])));
  }

  async getBlock(node: unknown, blockNumber: string): Promise<unknown> {
    const url = this.resolveUrl(node);
    const tag = /^\d+$/.test(blockNumber) ? `0x${BigInt(blockNumber).toString(16)}` : blockNumber;
    const block = await this.rpc(url, "eth_getBlockByNumber", [tag, true]);
    if (!block) {
      throw new ExplorerError(`block not found: ${blockNumber}`, 404);
    }
    return block;
  }

  async getTransaction(node: unknown, hash: string): Promise<unknown> {
    const url = this.resolveUrl(node);
    const [tx, receipt] = await Promise.all([
      this.rpc(url, "eth_getTransactionByHash", [hash]),
      this.rpc(url, "eth_getTransactionReceipt", [hash]),
    ]);
    if (!tx) {
      throw new ExplorerError(`transaction not found: ${hash}`, 404);
    }
    return { ...(tx as object), receipt };
  }

  private resolveUrl(node: unknown): string {
    if (!isNodeName(node)) {
      throw new ExplorerError("node must be one of anson/beatrice", 400);
    }
    return this.nodeUrls[node];
  }

  private async rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    });
    const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
    if (body.error) {
      throw new ExplorerError(body.error.message ?? "RPC error", 502);
    }
    return body.result;
  }
}
