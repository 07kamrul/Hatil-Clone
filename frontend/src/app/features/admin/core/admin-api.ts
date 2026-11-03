import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { toParams } from '../../../core/api';
import { API_BASE } from '../../../core/config';
import { Page, ProductCard, ProductDetail } from '../../../core/models';

export interface ImportResult { created: number; updated: number; failed: number; errors: string[] }
export interface Message { detail: string }
export type Row = Record<string, unknown> & { id: number };

/** Extract a readable message from a FastAPI error response. */
export function apiError(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`).join('; ');
    }
    if (error.status === 0) return 'Cannot reach the server';
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE)}/admin`;

  // ---------- generic resources ----------
  list<T = Row>(resource: string, query: Record<string, unknown> = {}): Observable<Page<T>> {
    return this.http.get<Page<T>>(`${this.base}/${resource}`, { params: toParams(query) });
  }
  all<T = Row>(resource: string): Observable<T[]> {
    return this.http.get<T[]>(`${this.base}/${resource}`);
  }
  get<T = Row>(resource: string, id: number): Observable<T> {
    return this.http.get<T>(`${this.base}/${resource}/${id}`);
  }
  create<T = Row>(resource: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${resource}`, body);
  }
  update<T = Row>(resource: string, id: number, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}/${resource}/${id}`, body);
  }
  remove(resource: string, id: number): Observable<Message> {
    return this.http.delete<Message>(`${this.base}/${resource}/${id}`);
  }
  reorder(resource: string, items: { id: number; sort_order: number }[]): Observable<Message> {
    return this.http.put<Message>(`${this.base}/${resource}/reorder`, items);
  }

  // ---------- products ----------
  products(query: Record<string, unknown>): Observable<Page<ProductCard>> {
    return this.http.get<Page<ProductCard>>(`${this.base}/products`, { params: toParams(query) });
  }
  product(id: number): Observable<ProductDetail> { return this.http.get<ProductDetail>(`${this.base}/products/${id}`); }
  createProduct(body: unknown): Observable<ProductDetail> { return this.http.post<ProductDetail>(`${this.base}/products`, body); }
  updateProduct(id: number, body: unknown): Observable<ProductDetail> { return this.http.patch<ProductDetail>(`${this.base}/products/${id}`, body); }
  uploadProductImages(id: number, files: File[]): Observable<ProductDetail> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    return this.http.post<ProductDetail>(`${this.base}/products/${id}/images`, form);
  }
  reorderImages(id: number, imageIds: number[]): Observable<ProductDetail> {
    return this.http.put<ProductDetail>(`${this.base}/products/${id}/images/order`, { image_ids: imageIds });
  }
  updateImage(id: number, imageId: number, body: { alt?: string; is_dimension?: boolean }): Observable<ProductDetail> {
    return this.http.patch<ProductDetail>(`${this.base}/products/${id}/images/${imageId}`, body);
  }
  deleteImage(id: number, imageId: number): Observable<ProductDetail> {
    return this.http.delete<ProductDetail>(`${this.base}/products/${id}/images/${imageId}`);
  }
  bulkPublish(ids: number[], isPublished: boolean): Observable<Message> {
    return this.http.post<Message>(`${this.base}/products/bulk/publish`, { ids, is_published: isPublished });
  }
  bulkPrice(body: { ids: number[]; mode: string; value: number; target: string; round_to: number }): Observable<Message> {
    return this.http.post<Message>(`${this.base}/products/bulk/price`, body);
  }
  bulkDelete(ids: number[]): Observable<Message> {
    return this.http.post<Message>(`${this.base}/products/bulk/delete`, { ids });
  }
  importProducts(file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.base}/products/import`, form);
  }
  exportProducts(fmt: 'csv' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.base}/products/export`, { params: { fmt }, responseType: 'blob' });
  }

  // ---------- misc ----------
  uploadImage(file: File, folder: string): Observable<{ url: string; thumb_url: string | null }> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ url: string; thumb_url: string | null }>(`${this.base}/uploads/image`, form, { params: { folder } });
  }
  settings(): Observable<Record<string, unknown>> { return this.http.get<Record<string, unknown>>(`${this.base}/settings`); }
  saveSettings(values: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>(`${this.base}/settings`, { values });
  }
  dashboard<T>(): Observable<T> { return this.http.get<T>(`${this.base}/dashboard`); }
  changePassword(current: string, next: string): Observable<Message> {
    return this.http.post<Message>(`${this.base.replace(/\/admin$/, '')}/auth/change-password`, { current_password: current, new_password: next });
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
