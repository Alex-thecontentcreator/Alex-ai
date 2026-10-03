import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Load system prompt safely
let SYSTEM = "You are Alex AI, a helpful AI assistant.";
try {
  SYSTEM = fs.readFileSync(path.join(__dirname, "system-prompt.md"), "utf8");
} catch (err) {
  console.warn("system-prompt.md not found, falling back to default prompt.");
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, message } = req.body || {};
    
    // Standardize input string
    let userPrompt = "";
    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      userPrompt = last.content || last.text || "";
    } else if (typeof message === "string") {
      userPrompt = message;
    }

    if (!userPrompt.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty." });
    }

    const provider = (process.env.PROVIDER || "gemini").toLowerCase();
    let replyText = "";

    // --- OPTION A: GOOGLE GEMINI ---
    if (provider === "gemini") {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const model = process.env.MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM}\n\nUser: ${userPrompt}` }],
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "Gemini API request failed.");
      }

      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } 
    
    // --- OPTION B: ANTHROPIC CLAUDE ---
    else if (provider === "claude" || provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.API_KEY;
      const model = process.env.MODEL || "claude-3-5-sonnet-20241022";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1024,
          system: SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "Claude API request failed.");
      }

      replyText = data.content?.[0]?.text;
    }

    // Fallback safeguard against 'undefined'
    if (!replyText) {
      replyText = "I received your message, but no output text was generated.";
    }

    res.json({ reply: replyText });
  } catch (err) {
    console.error("Chat handler error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alex AI running on port ${PORT}`));
