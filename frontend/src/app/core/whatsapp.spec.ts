import {
  CartLine, MAX_MESSAGE_LENGTH, buildOrderMessage, buildWhatsAppUrl, cartTotal, fillTemplate, formatMoney, lineKey,
  normalizeWhatsAppNumber,
} from './whatsapp';
import { DEFAULT_TEMPLATE } from './settings-store';

const sofa: CartLine = {
  key: lineKey(1, 'Walnut'), productId: 1, slug: 'aria-sofa', sku: 'AR-1', name: 'Aria Sofa', image: null,
  variant: 'Walnut', unitPrice: 45000, quantity: 2,
};
const chair: CartLine = {
  key: lineKey(2, null), productId: 2, slug: 'cleo-chair', sku: 'CL-9', name: 'Cleo Chair', image: null,
  variant: null, unitPrice: 7900, quantity: 1,
};

const base = { template: DEFAULT_TEMPLATE, siteName: 'Casa', currencySymbol: '৳', origin: 'https://shop.test' };

describe('whatsapp message builder', () => {
  it('formats money with thousands separators', () => {
    expect(formatMoney(45000, '৳')).toBe('৳45,000');
    expect(formatMoney(1234.6, '$')).toBe('$1,235');
    expect(formatMoney(0, '$')).toBe('Price on request');
  });

  it('sums the cart', () => {
    expect(cartTotal([sofa, chair])).toBe(97900);
    expect(cartTotal([])).toBe(0);
  });

  it('keys lines by product and variant', () => {
    expect(lineKey(1, 'Walnut')).not.toBe(lineKey(1, 'Grey'));
    expect(lineKey(1, null)).toBe('1::');
  });

  it('includes name, sku, variant, qty, price, total and product url', () => {
    const text = buildOrderMessage({ ...base, lines: [sofa, chair] });
    expect(text).toContain('Hello Casa!');
    expect(text).toContain('1. Aria Sofa');
    expect(text).toContain('SKU: AR-1');
    expect(text).toContain('Variant: Walnut');
    expect(text).toContain('Qty: 2 x ৳45,000 = ৳90,000');
    expect(text).toContain('Link: https://shop.test/product/aria-sofa');
    expect(text).toContain('2. Cleo Chair');
    expect(text).not.toContain('Variant: null');
    expect(text).toContain('Total: ৳97,900');
  });

  it('adds customer details typed by the visitor and dashes for blanks', () => {
    const text = buildOrderMessage({
      ...base, lines: [chair], customer: { name: ' Rahim ', phone: '01711000000', address: '', note: undefined },
    });
    expect(text).toContain('Name: Rahim');
    expect(text).toContain('Phone: 01711000000');
    expect(text).toContain('Address: -');
    expect(text).toContain('Note: -');
  });

  it('supports admin-edited templates and keeps unknown placeholders', () => {
    expect(fillTemplate('Hi {site_name} {oops}', { site_name: 'Casa' })).toBe('Hi Casa {oops}');
    const text = buildOrderMessage({ ...base, template: 'ORDER\n{items}\nSum {total}', lines: [chair] });
    expect(text.startsWith('ORDER')).toBe(true);
    expect(text.endsWith('Sum ৳7,900')).toBe(true);
  });

  it('truncates absurdly long messages', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ ...chair, key: `k${i}`, name: `Product ${i} `.repeat(5) }));
    const text = buildOrderMessage({ ...base, lines: many });
    expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });

  it('builds a wa.me url with digits only and an encoded text', () => {
    expect(normalizeWhatsAppNumber('+880 1711-000000')).toBe('8801711000000');
    const url = buildWhatsAppUrl('+880 1711-000000', 'Hello & welcome\nline 2');
    expect(url).toBe('https://wa.me/8801711000000?text=Hello%20%26%20welcome%0Aline%202');
  });
});
