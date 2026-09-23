/**
 * Attest — a minimal Realtime (Phoenix channel) client.
 *
 * Enough of the protocol to answer the questions F8's socket cases ask: does
 * the real client path reach the row policies on `realtime.messages`, and what
 * does a subscriber actually receive?
 *
 * Two things make those answers mean something (D3.44):
 *
 *   `config.private = true` on every join. Realtime consults the policies only
 *   for a private channel; a client that joined non-privately would bypass them
 *   while every SQL test still passed (D3.7).
 *
 *   A server-originated message during every observation window. "The
 *   subscription delivers nothing" is vacuous if nothing was sent. So the
 *   runner has the server broadcast onto the topic (`realtime.send`) while the
 *   subscriber listens, and an authorised observer must receive that same
 *   message — proof the broadcast went out — before the unauthorised client's
 *   silence is counted.
 *
 * Written against the websocket rather than pulled in as a dependency because
 * the supabase-js client retries, buffers and reconnects, and a probe that
 * cannot say exactly what it sent and exactly what came back is not evidence.
 */
export interface JoinReply {
  readonly status: "ok" | "error" | "timeout" | "closed";
  readonly response: unknown;
}

interface Frame {
  readonly topic?: string;
  readonly event?: string;
  readonly ref?: string | null;
  readonly payload?: { status?: string; response?: unknown; event?: string; payload?: unknown; type?: string };
}

export class RealtimeClient {
  private ws: any = null;
  private ref = 0;
  private readonly frames: Frame[] = [];
  readonly log: string[] = [];
  private waiters: { match: (f: Frame) => boolean; resolve: (f: Frame | null) => void }[] = [];

  private readonly url: string;
  private readonly token: string;
  readonly label: string;

  constructor(url: string, token: string, label: string) {
    this.url = url;
    this.token = token;
    this.label = label;
  }

  async connect(timeoutMs = 8000): Promise<void> {
    const WS = (globalThis as { WebSocket?: unknown }).WebSocket;
    if (!WS) throw new Error("no global WebSocket in this Node runtime; the Realtime probe cannot run");
    const ws = new (WS as { new (u: string): any })(`${this.url}?apikey=${encodeURIComponent(this.token)}&vsn=1.0.0`);
    this.ws = ws;
    ws.onmessage = (ev: { data: unknown }) => {
      let f: Frame;
      try { f = JSON.parse(String(ev.data)) as Frame; } catch { return; }
      this.frames.push(f);
      for (const w of [...this.waiters]) {
        if (w.match(f)) { this.waiters = this.waiters.filter((x) => x !== w); w.resolve(f); }
      }
    };
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${this.label}: websocket did not open within ${timeoutMs}ms`)), timeoutMs);
      ws.onopen = () => { clearTimeout(t); this.log.push(`${this.label}: socket open`); resolve(); };
      ws.onerror = (e: unknown) => { clearTimeout(t); reject(new Error(`${this.label}: websocket error ${String((e as { message?: string })?.message ?? e)}`)); };
    });
  }

  private send(topic: string, event: string, payload: unknown, joinRef: string | null): string {
    const ref = String(++this.ref);
    this.ws.send(JSON.stringify({ topic, event, payload, ref, join_ref: joinRef }));
    return ref;
  }

  private waitFor(match: (f: Frame) => boolean, timeoutMs: number): Promise<Frame | null> {
    const hit = this.frames.find(match);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve) => {
      const w = { match, resolve };
      this.waiters.push(w);
      setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); resolve(null); }, timeoutMs);
    });
  }

  /** Join `topic` as a PRIVATE channel with broadcast acks on. */
  async join(topic: string, timeoutMs = 8000): Promise<{ reply: JoinReply; joinRef: string }> {
    const t = `realtime:${topic}`;
    const ref = this.send(t, "phx_join", {
      config: { private: true, broadcast: { self: true, ack: true }, presence: { key: "" } },
      access_token: this.token,
    }, null);
    const f = await this.waitFor((x) => x.topic === t && x.event === "phx_reply" && x.ref === ref, timeoutMs);
    const reply: JoinReply = f
      ? { status: f.payload?.status === "ok" ? "ok" : "error", response: f.payload?.response ?? null }
      : { status: "timeout", response: null };
    this.log.push(`${this.label}: join ${topic} (private) -> ${reply.status} ${JSON.stringify(reply.response ?? {}).slice(0, 160)}`);
    return { reply, joinRef: ref };
  }

  /** Push a client broadcast and wait for its ack; resolves the ack status. */
  async broadcast(topic: string, joinRef: string, event: string, payload: Record<string, unknown>, timeoutMs = 4000): Promise<JoinReply> {
    const t = `realtime:${topic}`;
    const ref = this.send(t, "broadcast", { type: "broadcast", event, payload }, joinRef);
    const f = await this.waitFor((x) => x.topic === t && x.event === "phx_reply" && x.ref === ref, timeoutMs);
    const r: JoinReply = f ? { status: f.payload?.status === "ok" ? "ok" : "error", response: f.payload?.response ?? null } : { status: "timeout", response: null };
    this.log.push(`${this.label}: broadcast '${event}' -> ack ${r.status} ${JSON.stringify(r.response ?? {}).slice(0, 120)}`);
    return r;
  }

  /** Every broadcast payload this client has received on `topic`. */
  received(topic: string): { event: string | undefined; payload: unknown }[] {
    const t = `realtime:${topic}`;
    return this.frames
      .filter((f) => f.topic === t && f.event === "broadcast")
      .map((f) => ({ event: f.payload?.event, payload: f.payload?.payload }));
  }

  /** Wait until a broadcast carrying `marker` arrives, or the timeout passes. */
  async waitForMarker(topic: string, marker: string, timeoutMs: number): Promise<boolean> {
    const t = `realtime:${topic}`;
    const f = await this.waitFor((x) => x.topic === t && x.event === "broadcast" && JSON.stringify(x.payload ?? {}).includes(marker), timeoutMs);
    return f !== null;
  }

  close(): void {
    try { this.ws?.close(); } catch { /* already closing */ }
  }
}
