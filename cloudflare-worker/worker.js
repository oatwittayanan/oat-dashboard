// OAT Dashboard — Cloudflare Worker (Notion API Proxy)
// Deploy ที่ Cloudflare Workers แล้วตั้ง env var: NOTION_TOKEN
// และ ALLOWED_ORIGIN = URL ของ GitHub Pages เว็บ Dashboard

const NOTION_VERSION = "2022-06-28";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse("", 204, env);
    }

    const url = new URL(request.url);
    const notionPath = url.pathname.replace(/^\/?api/, "");
    const notionUrl = `https://api.notion.com/v1${notionPath}${url.search}`;

    const body = ["POST", "PATCH"].includes(request.method)
      ? await request.text()
      : undefined;

    const notionRes = await fetch(notionUrl, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body,
    });

    const data = await notionRes.text();
    return corsResponse(data, notionRes.status, env);
  },
};

function corsResponse(body, status, env) {
  const origin = env.ALLOWED_ORIGIN || "*";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
