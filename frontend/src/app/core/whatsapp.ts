export interface CartLine {
  key: string;
  productId: number;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
  variant: string | null;
  unitPrice: number;
  quantity: number;
}

export interface CustomerDetails {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export interface MessageOptions {
  template: string;
  siteName: string;
  currencySymbol: string;
  origin: string;
  lines: readonly CartLine[];
  customer?: CustomerDetails;
}

/** WhatsApp truncates very long prefilled messages in some clients; keep well under the practical limit. */
export const MAX_MESSAGE_LENGTH = 3500;

export function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
}

export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function lineKey(productId: number, variant: string | null): string {
  return `${productId}::${variant ?? ''}`;
}

function describeLine(line: CartLine, index: number, opts: MessageOptions): string {
  const price = formatMoney(line.unitPrice, opts.currencySymbol);
  const subtotal = formatMoney(line.unitPrice * line.quantity, opts.currencySymbol);
  const parts = [
    `${index + 1}. ${line.name}`,
    `   SKU: ${line.sku}`,
    ...(line.variant ? [`   Variant: ${line.variant}`] : []),
    `   Qty: ${line.quantity} x ${price} = ${subtotal}`,
    `   Link: ${opts.origin}/product/${line.slug}`,
  ];
  return parts.join('\n');
}

/** Replace `{placeholders}`; unknown placeholders are left untouched, empty values become "-". */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] || '-' : match,
  );
}

export function buildOrderMessage(opts: MessageOptions): string {
  const customer = opts.customer ?? {};
  const items = opts.lines.map((l, i) => describeLine(l, i, opts)).join('\n\n');
  const message = fillTemplate(opts.template, {
    site_name: opts.siteName,
    items,
    total: formatMoney(cartTotal(opts.lines), opts.currencySymbol),
    name: (customer.name ?? '').trim(),
    phone: (customer.phone ?? '').trim(),
    address: (customer.address ?? '').trim(),
    note: (customer.note ?? '').trim(),
  });
  return message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
    : message;
}

/** Digits only: wa.me rejects "+", spaces and dashes. */
export function normalizeWhatsAppNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
}
