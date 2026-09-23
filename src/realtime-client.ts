/**
 * Attest — a minimal Realtime (Phoenix channel) client.
 *
 * Enough of the protocol to answer the one question F8's integration cases ask:
 * does the real client path reach the row policies on `realtime.messages`, or
 * does it go around them?
 *
 * The answer turns on **`config.private`**. Realtime consults those policies
 * only when a channel is declared private; a client that joined
 * non-privately would bypass them entirely while every SQL test still passed.
 * So `private: true` is set on every join here, and that is the whole point of
 * the probe rather than a detail of it (D3.7).
 *
 * Written against the websocket rather than pulled in as a dependency because
 * the supabase-js client retries, buffers and reconnects, and a probe that
 * cannot say exactly what it sent and exactly what came back is not evidence.
 */
export interface JoinResult {
  /** Did the server accept the join? */
  readonly joined: boolean;
  /** How many broadcast payloads reached this client on the topic. */
  readonly payloadsReceived: number;
  readonly notes: readonly string[];
}

export interface JoinOptions {
  readonly url: string;
  readonly token: string;
  readonly topic: string;
  /** Also attempt to broadcast onto the topic after joining. */
  readonly publish?: boolean;
  readonly timeoutMs?: number;
}

/**
 * Join a private channel, optionally publish, and report what happened.
 *
 * Never throws for a refusal — a refusal is the result. It throws only when the
 * probe itself could not be carried out (no service, no socket), which the
 * caller records as a harness error rather than as a control outcome.
 */
export async function joinRealtime(opts: JoinOptions): Promise<JoinResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const notes: string[] = [];
  // Node exposes a global WebSocket from 22 onward. Fail loudly rather than
  // silently degrading, so a missing runtime feature cannot look like a refusal.
  const WS = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (!WS) throw new Error("no global WebSocket in this Node runtime; the Realtime probe cannot run");

  const url = `${opts.url}?apikey=${encodeURIComponent(opts.token)}&vsn=1.0.0`;
  const ws = new (WS as unknown as { new (u: string): any })(url);

  let joined = false;
  let payloads = 0;
  let settled = false;

  return await new Promise<JoinResult>((resolve, reject) => {
    const done = (r: JoinResult) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* already closing */ }
      resolve(r);
    };
    const timer = setTimeout(() => {
      notes.push(`no terminal reply within ${timeoutMs}ms — recorded as not joined`);
      done({ joined, payloadsReceived: payloads, notes });
    }, timeoutMs);

    ws.onerror = (e: unknown) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error(`websocket error: ${String((e as { message?: string })?.message ?? e)}`)); }
    };

    ws.onopen = () => {
      notes.push("socket open");
      ws.send(JSON.stringify({
        topic: `realtime:${opts.topic}`,
        event: "phx_join",
        ref: "1",
        join_ref: "1",
        payload: {
          // private: true is what makes Realtime consult the row policies.
          config: { private: true, broadcast: { self: true }, presence: { key: "" } },
          access_token: opts.token,
        },
      }));
    };

    ws.onmessage = (ev: { data: unknown }) => {
      let msg: { event?: string; payload?: { status?: string; response?: unknown } };
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.event === "phx_reply") {
        const status = msg.payload?.status;
        notes.push(`phx_reply status=${status} ${JSON.stringify(msg.payload?.response ?? {}).slice(0, 160)}`);
        if (status === "ok") {
          joined = true;
          if (opts.publish) {
            ws.send(JSON.stringify({
              topic: `realtime:${opts.topic}`, event: "broadcast", ref: "2", join_ref: "1",
              payload: { type: "broadcast", event: "state", payload: { attest_synthetic: true } },
            }));
            notes.push("broadcast attempted after join");
            // Give the server a moment to accept or drop it.
            setTimeout(() => { clearTimeout(timer); done({ joined, payloadsReceived: payloads, notes }); }, 1500);
            return;
          }
          // Give the server a moment to deliver anything it intends to.
          setTimeout(() => { clearTimeout(timer); done({ joined, payloadsReceived: payloads, notes }); }, 1500);
        } else {
          clearTimeout(timer);
          done({ joined: false, payloadsReceived: payloads, notes });
        }
      } else if (msg.event === "broadcast") {
        payloads++;
        notes.push("a broadcast payload reached this client");
      } else if (msg.event === "phx_error" || msg.event === "phx_close") {
        notes.push(`channel ${msg.event}`);
        clearTimeout(timer);
        done({ joined: false, payloadsReceived: payloads, notes });
      }
    };
  });
}
