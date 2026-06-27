#!/usr/bin/env node
// Live UI Annotate — channel server.
//
// A Claude Code *channel*: an MCP server (stdio) that PUSHES events into the
// running session. The drawing toolbar overlaid on the page POSTs to the local
// HTTP listener here when the user hits Send; we forward that as a
// `notifications/claude/channel` event, so Claude reacts even when it is not
// parked in a tool call. Two-way: Claude calls the `reply` tool to show a toast
// back on the page (SSE on /events).
//
// stdout is reserved for the MCP JSON-RPC stream — every log goes to stderr.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";

const PORT = Number(process.env.ANNOTATE_PORT || 8799);

// --- outbound (Claude -> overlay): SSE listeners for toasts ----------------
const listeners = new Set();
function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of listeners) { try { res.write(data); } catch (e) {} }
}

const mcp = new Server(
  { name: "annotate", version: "0.2.0" },
  {
    capabilities: { experimental: { "claude/channel": {} }, tools: {} },
    instructions: [
      "The 'annotate' channel delivers live UI feedback from a drawing toolbar overlaid on the page open in the Playwright MCP browser.",
      "A <channel source=\"annotate\"> event means the user drew annotations on the page at the given url and pressed Send.",
      "When one arrives, do this in order, without narrating the mechanics:",
      "(1) browser_evaluate `() => window.__annot && window.__annot.setBar(false)` to hide the toolbar;",
      "(2) browser_take_screenshot as png, viewport only (NOT fullPage), to .playwright-mcp/annot.png;",
      "(3) browser_evaluate `() => window.__annot && window.__annot.arm()` to clear the canvas and restore the toolbar;",
      "(4) Read the PNG and incorporate the drawn feedback into the code.",
      "Then call the annotate 'reply' tool with one short line describing what you changed or are doing, so the user sees a confirmation toast on the page.",
      "If window.__annot is missing, the overlay is not loaded — (re)inject it per the annotate skill before continuing.",
    ].join(" "),
  }
);

// --- reply tool (Claude -> overlay toast) ----------------------------------
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "reply",
    description: "Show a short confirmation toast on the annotated page. One line: what you changed or are doing.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "One short line to show the user." } },
      required: ["text"],
    },
  }],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "reply") {
    const text = String((req.params.arguments || {}).text || "").trim();
    broadcast({ type: "toast", text });
    return { content: [{ type: "text", text: "shown" }] };
  }
  throw new Error(`unknown tool: ${req.params.name}`);
});

await mcp.connect(new StdioServerTransport());

// --- inbound (overlay -> Claude): HTTP listener ----------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // overlay subscribes here for reply toasts
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    res.write(": connected\n\n");
    listeners.add(res);
    req.on("close", () => listeners.delete(res));
    return;
  }

  // overlay's health ping (lets it tell "channel not running" from a real error)
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  // overlay Send -> push a channel event into the session
  if (req.method === "POST" && url.pathname === "/send") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      let info = {};
      try { info = JSON.parse(body || "{}"); } catch (e) {}
      const pageUrl = String(info.url || "");
      const marks = String(info.notes ?? "");
      try {
        await mcp.notification({
          method: "notifications/claude/channel",
          params: {
            content: `User submitted UI annotations (${marks} mark${marks === "1" ? "" : "s"})${pageUrl ? " on " + pageUrl : ""}. Capture and incorporate them now.`,
            meta: { url: pageUrl, marks },
          },
        });
      } catch (e) { process.stderr.write(`annotate: notify failed: ${e}\n`); }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404, CORS); res.end("not found");
}).listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`annotate channel: http://localhost:${PORT}\n`);
});
