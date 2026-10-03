import express from "express";
import fs from "node:fs";

const {
  API_KEY,
  BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai",
  MODEL = "gemini-3.8-flash",
  API_STYLE = "chat", // "chat" works with Gemini and most providers; "responses" is for OpenAI
  PORT = 3000, ACCESS_CODE, ENABLE_SEARCH,
} = process.env;
if (!API_KEY) { console.error("Missing API_KEY environment variable."); process.exit(1); }
if (!ACCESS_CODE) console.warn("WARNING: ACCESS_CODE is not set. Anyone with your link can use your API key.");

const SYSTEM = fs.readFileSync(new URL("./system-prompt.md", import.meta.url), "utf8");
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  if (ACCESS_CODE && req.get("x-access-code") !== ACCESS_CODE)
    return res.status(401).json({ error: "Wrong or missing access code" });
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];
  const input = msgs
    .filter(m => ["user", "assistant"].includes(m?.role) && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!input.length) return res.status(400).json({ error: "No messages" });

  const useResponses = API_STYLE === "responses";
  let url, body;
  if (useResponses) {
    url = `${BASE_URL}/responses`;
    body = { model: MODEL, instructions: SYSTEM, input };
    if (ENABLE_SEARCH === "true") body.tools = [{ type: "web_search" }];
  } else {
    url = `${BASE_URL}/chat/completions`;
    body = { model: MODEL, messages: [{ role: "system", content: SYSTEM }, ...input] };
  }
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || data?.[0]?.error?.message || "Provider error";
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "Free limit reached. Wait a minute and try again." : msg });
    }
    const reply = useResponses
      ? (data.output || []).filter(o => o.type === "message").flatMap(o => o.content || [])
          .filter(c => c.type === "output_text").map(c => c.text).join("")
      : data.choices?.[0]?.message?.content ?? "";
    res.json({ reply: reply || "(No reply)" });
  } catch (e) {
    res.status(500).json({ error: "Request failed: " + e.message });
  }
});

app.listen(PORT, () => console.log(`Alex AI running on port ${PORT}`));
