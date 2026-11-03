import { DOCUMENT } from '@angular/common';
import { Injectable, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { SITE_ORIGIN } from './config';
import { SettingsStore } from './settings-store';

export interface SeoData {
  title: string;
  description?: string | null;
  image?: string | null;
  path?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: object | object[] | null;
}

const JSON_LD_ID = 'app-jsonld';

@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly origin = inject(SITE_ORIGIN);
  private readonly settings = inject(SettingsStore);
  private readonly response = inject(RESPONSE_INIT, { optional: true });

  set(data: SeoData): void {
    const site = this.settings.settings().site_name;
    const fullTitle = data.title && data.title !== site ? `${data.title} | ${site}` : site;
    const description = (data.description || this.settings.settings().meta_description || '').slice(0, 300);
    const url = this.absolute(data.path ?? '/');
    const image = data.image ? this.absolute(data.image) : '';

    this.title.setTitle(fullTitle);
    this.upsert('name', 'description', description);
    this.upsert('name', 'robots', data.noindex ? 'noindex,nofollow' : 'index,follow');
    this.upsert('property', 'og:title', fullTitle);
    this.upsert('property', 'og:description', description);
    this.upsert('property', 'og:type', data.type ?? 'website');
    this.upsert('property', 'og:url', url);
    this.upsert('property', 'og:site_name', site);
    this.upsert('property', 'og:image', image);
    this.upsert('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    this.setCanonical(url);
    this.setJsonLd(data.jsonLd ?? null);
  }

  /** Sets the HTTP status of the server-rendered response (no-op in the browser). */
  setStatus(status: number): void {
    if (this.response) this.response.status = status;
  }

  /** Public origin without a trailing slash, e.g. "https://shop.example". */
  siteOrigin(): string {
    return this.absolute('/').replace(/\/$/, '');
  }

  absolute(pathOrUrl: string): string {
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    return `${this.origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  private upsert(attr: 'name' | 'property', key: string, content: string): void {
    if (!content) {
      this.meta.removeTag(`${attr}="${key}"`);
      return;
    }
    this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: object | object[] | null): void {
    this.doc.getElementById(JSON_LD_ID)?.remove();
    if (!data) return;
    const script = this.doc.createElement('script');
    script.id = JSON_LD_ID;
    script.type = 'application/ld+json';
    // Escape "<" so content can never close the script element.
    script.text = JSON.stringify(data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(script);
  }
}
