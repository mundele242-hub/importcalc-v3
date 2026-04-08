exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY non configuree dans Netlify." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON invalide." }) };
  }

  const { importData } = body;
  if (!importData) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "importData manquant." }) };
  }

  const prompt = buildPrompt(importData);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: "Tu es un expert import-export Chine vers France, Maroc, Congo. Reponds UNIQUEMENT en JSON valide: {\"risque\":\"faible|moyen|eleve\",\"resume\":\"phrase\",\"points_cles\":[\"p1\",\"p2\",\"p3\"],\"conseil_principal\":\"conseil\",\"alertes\":[],\"optimisation\":\"suggestion\"}",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    let analysis;
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      analysis = { risque: "moyen", resume: text.substring(0, 200), points_cles: [], conseil_principal: "Consultez un transitaire.", alertes: [], optimisation: "" };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, analysis }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erreur: " + err.message }) };
  }
};

function buildPrompt(d) {
  return "Analyse cet import: PRODUIT: " + d.type + " DESTINATION: " + d.pays + " VALEUR: " + d.valEUR + " EUR TRANSPORT: " + d.mode + " INCOTERM: " + d.incoterm + " DROITS: " + d.dd + " EUR TVA: " + d.tva + " EUR TOTAL: " + d.total_final + " EUR STATUT: " + d.achat + " - " + d.usage;
}
