app.post("/api/chat", async (req, res) => {
  try {
    const { message, messages } = req.body || {};

    // 1. Extract prompt safely from either format
    let userPrompt = "";
    if (typeof message === "string" && message.trim()) {
      userPrompt = message.trim();
    } else if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      userPrompt = last.content || last.text || "";
    }

    if (!userPrompt) {
      return res.status(400).json({ error: "No message text provided." });
    }

    // 2. Read Gemini credentials from environment
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    const model = process.env.MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_KEY in server environment." });
    }

    // 3. Call Google Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(url, {
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

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("Gemini API Error:", data);
      const errorMsg = data?.error?.message || "Gemini API call failed";
      return res.status(apiResponse.status).json({ error: errorMsg });
    }

    // 4. Extract reply text cleanly
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No text generated from model.";

    // Sends back { reply: "..." } matching your frontend's data.reply
    res.json({ reply: replyText });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
