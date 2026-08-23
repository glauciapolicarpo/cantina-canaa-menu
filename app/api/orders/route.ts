import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders } from "../../../db/schema";

type LocalOrder = { id: number; reference: string; customerName: string; itemsJson: string; totalCents: number; paymentStatus: string; pixStatus: string; receiptText: string | null; receiptLink: string | null; createdAt: string };
const localOrders: LocalOrder[] = [];
const recipientEmail = "criatividadeedesigner@gmail.com";
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);

export async function GET() {
  try {
    const db = getDb();
    return Response.json({ orders: await db.select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id)).limit(100) });
  } catch (error) {
    return Response.json({ orders: localOrders, storage: "local-preview" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { customerName?: string; items?: Array<{ name?: string; quantity?: number; price?: number }>; totalCents?: number; paymentMethod?: "cash" | "pix"; changeForCents?: number | null; receiptText?: string; receiptLink?: string };
    const totalCents = body.totalCents;
    if (!body.customerName?.trim() || !Array.isArray(body.items) || !body.items.length || typeof totalCents !== "number" || !Number.isInteger(totalCents) || totalCents <= 0) return Response.json({ error: "Dados do pedido inválidos." }, { status: 400 });
    const reference = `CCB-${Date.now().toString(36).toUpperCase()}`;
    const values = { reference, customerName: body.customerName.trim(), itemsJson: JSON.stringify(body.items), totalCents, paymentStatus: "pending", pixStatus: "not_configured", receiptText: body.receiptText?.trim() || null, receiptLink: body.receiptLink?.trim() || null, createdAt: new Date().toISOString() };
    let order: LocalOrder;
    try {
      const db = getDb();
      [order] = await db.insert(orders).values(values).returning() as unknown as [LocalOrder];
    } catch {
      order = { id: localOrders.length + 1, ...values };
      localOrders.unshift(order);
    }
    const method = body.paymentMethod === "cash" ? "À vista" : "Pix";
    const changeForCents = method === "À vista" ? body.changeForCents ?? 0 : 0;
    const changeCents = Math.max(0, changeForCents - order.totalCents);
    const itemLines = body.items.map((item) => `${item.quantity ?? 0}x ${item.name ?? "Item"}`).join(", ");
    let emailStatus = "not_configured";
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipientEmail], subject: `Novo pedido ${order.reference} — ${order.customerName}`, html: `<h2>Novo pedido ${escapeHtml(order.reference)}</h2><p><b>Nome:</b> ${escapeHtml(order.customerName)}</p><p><b>Pedido:</b> ${escapeHtml(itemLines)}</p><p><b>Valor:</b> ${brl(order.totalCents)}</p><p><b>Método de pagamento:</b> ${method}</p>${method === "À vista" ? `<p><b>Cliente paga com:</b> ${brl(changeForCents)}<br/><b>Troco a devolver:</b> ${brl(changeCents)}</p>` : ""}` }) });
      emailStatus = emailResponse.ok ? "sent" : "error";
    }
    let sheetSync = "not_configured";
    const sheetWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetWebhook) {
      try {
        const payload = { referencia: order.reference, data: order.createdAt, nome: order.customerName, pedido: body.items, valor_total: order.totalCents / 100, metodo_pagamento: method, valor_pago_dinheiro: method === "À vista" ? changeForCents / 100 : "", troco_a_devolver: method === "À vista" ? changeCents / 100 : "", status_pagamento: "Pendente" };
        const syncResponse = await fetch(sheetWebhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        sheetSync = syncResponse.ok ? "sent" : "error";
      } catch { sheetSync = "error"; }
    }
    return Response.json({ order, emailStatus, sheetSync, pix: { configured: Boolean(process.env.PIX_PROVIDER), status: "not_configured", message: "Configure PIX_PROVIDER e as credenciais do provedor para gerar o QR Code dinâmico." } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 });
  }
}
