const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!process.env.ANTHROPIC_API_KEY) require("dotenv").config({ path: path.join(__dirname, "..", "slideforge", ".env") });
const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ maxRetries: 0, timeout: 30000 });
(async () => {
  for (const model of ["claude-haiku-4-5-20251001", "claude-sonnet-5"]) {
    const t = Date.now();
    try {
      const m = await client.messages.create({ model, max_tokens: 20, messages: [{ role: "user", content: "Say hi" }] });
      console.log(model, "OK", Math.round((Date.now()-t)/100)/10, "s", JSON.stringify(m.content[0].text));
    } catch (e) {
      console.log(model, "ERREUR", Math.round((Date.now()-t)/100)/10, "s", e.status || "", String(e.message||"").slice(0,200));
    }
  }
})();