import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './config';
import {
  Banner, BlogPost, BlogSummary, CategoryDetail, CategoryNode, CmsPage, Color, ContactPayload, Faq, Material,
  Page, ProductCard, ProductDetail, ProductFacets, ProductQuery, Room, SiteSettings, Showroom, Suggestion,
} from './models';

export interface InquiryItemPayload {
  product_id: number;
  slug: string;
  sku: string;
  name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
}

export function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) continue;
    params = params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  private get<T>(path: string, query: Record<string, unknown> = {}): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`, { params: toParams(query) });
  }

  settings(): Observable<SiteSettings> { return this.get('/settings/public'); }
  products(query: ProductQuery): Observable<Page<ProductCard>> { return this.get('/products', { ...query }); }
  facets(query: ProductQuery): Observable<ProductFacets> {
    const { page: _p, page_size: _s, sort: _o, ...rest } = query;
    return this.get('/products/facets', { ...rest });
  }
  product(slug: string): Observable<ProductDetail> { return this.get(`/products/${encodeURIComponent(slug)}`); }
  related(slug: string, limit = 8): Observable<ProductCard[]> { return this.get(`/products/${encodeURIComponent(slug)}/related`, { limit }); }
  compare(ids: number[]): Observable<ProductDetail[]> { return this.get('/products/compare', { ids }); }
  productsByIds(ids: number[]): Observable<ProductCard[]> { return this.get('/products/by-ids', { ids }); }
  categoryTree(): Observable<CategoryNode[]> { return this.get('/categories/tree'); }
  featuredCategories(limit = 8): Observable<{ id: number; name: string; slug: string; image: string | null }[]> {
    return this.get('/categories/featured', { limit });
  }
  category(slug: string): Observable<CategoryDetail> { return this.get(`/categories/${encodeURIComponent(slug)}`); }
  rooms(): Observable<Room[]> { return this.get('/rooms'); }
  colors(): Observable<Color[]> { return this.get('/colors'); }
  materials(): Observable<Material[]> { return this.get('/materials'); }
  search(q: string): Observable<Suggestion[]> { return this.get('/search', { q }); }
  banners(placement?: string): Observable<Banner[]> { return this.get('/banners', { placement }); }
  showrooms(city?: string): Observable<Showroom[]> { return this.get('/showrooms', { city }); }
  showroomCities(): Observable<string[]> { return this.get('/showrooms/cities'); }
  showroom(slug: string): Observable<Showroom> { return this.get(`/showrooms/${encodeURIComponent(slug)}`); }
  blog(page = 1, pageSize = 9): Observable<Page<BlogSummary>> { return this.get('/blog', { page, page_size: pageSize }); }
  blogPost(slug: string): Observable<{ post: BlogPost; related: BlogSummary[] }> { return this.get(`/blog/${encodeURIComponent(slug)}`); }
  footerPages(): Observable<{ title: string; slug: string }[]> { return this.get('/pages'); }
  page(slug: string): Observable<CmsPage> { return this.get(`/pages/${encodeURIComponent(slug)}`); }
  faqs(home = false): Observable<Faq[]> { return this.get('/faqs', { home: home || undefined }); }

  sendContact(payload: ContactPayload): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.base}/contact`, payload);
  }

  logInquiry(items: InquiryItemPayload[], customer: { name?: string; phone?: string; address?: string; note?: string }, source: 'cart' | 'product'): Observable<unknown> {
    return this.http.post(`${this.base}/inquiries`, {
      items,
      customer_name: customer.name || null,
      phone: customer.phone || null,
      address: customer.address || null,
      note: customer.note || null,
      source,
    });
  }
}
