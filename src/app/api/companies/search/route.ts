import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSearchProvider } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const hits = await getSearchProvider().searchCompanies(q, { limit: 8 });
  const companies = await prisma.company.findMany({ where: { id: { in: hits.map((h) => h.id) }, isPlaceholder: false }, select: { id: true, slug: true, name: true, city: true, contacts: { where: { optOutAt: null }, select: { id: true, firstName: true, lastName: true, displayName: true, jobTitle: true } } } });
  const order = new Map(hits.map((h, i) => [h.id, i]));
  companies.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return NextResponse.json({ items: companies.map((c) => ({ ...c, contacts: c.contacts.map((ct) => ({ id: ct.id, name: `${ct.firstName} ${ct.lastName}`.trim() || ct.displayName || "Contact", jobTitle: ct.jobTitle })) })) });
}
