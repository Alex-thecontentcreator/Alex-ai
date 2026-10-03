import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let SYSTEM = "You are Alex AI, a helpful assistant.";
try {
  SYSTEM = fs.readFileSync(path.join(__dirname, "system-prompt.md"), "utf8");
} catch (err) {
  console.warn("system-prompt.md not found, using default assistant persona.");
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    const apiKey = process.env.API_KEY;
    const model = process.env.MODEL || "gemini-3.8-flash";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM}\n\nUser: ${message}` }],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Error calling Gemini API",
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No reply generated.";

    res.json({ reply });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alex AI server running on port ${PORT}`));
