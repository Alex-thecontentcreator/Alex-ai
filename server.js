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

app.listen(PORT, () => console.log(`Alex AI 
