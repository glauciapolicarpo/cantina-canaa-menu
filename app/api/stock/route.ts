export async function GET() {
  const webhook = process.env.STOCK_WEBHOOK_URL;
  if (!webhook) return Response.json({ error: "Estoque não configurado." }, { status: 503 });
  try {
    const response = await fetch(webhook, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) return Response.json({ error: data.error || "Não foi possível consultar o estoque." }, { status: 502 });
    return Response.json({ estoque: data.estoque || {} });
  } catch {
    return Response.json({ error: "Não foi possível consultar o estoque." }, { status: 502 });
  }
}
