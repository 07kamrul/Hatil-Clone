import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { Color, Material, ProductDetail, ProductImage, Room, StockStatus } from '../../../core/models';
import { Toast } from '../../../core/toast';
import { AdminApi, apiError } from '../core/admin-api';
import { HtmlEditor } from '../ui/html-editor';

interface CategoryOption { id: number; name: string; parent_id: number | null }
interface VariantForm { color_id: number | null; size: string; sku: string; price_delta: number; stock_status: StockStatus }
interface SpecForm { key: string; value: string }

interface ProductForm {
  name: string; slug: string; sku: string; price: number | null; sale_price: number | null; stock_status: StockStatus;
  category_id: number | null; short_desc: string; description_html: string; dimensions: string; warranty: string;
  is_featured: boolean; is_best_seller: boolean; is_published: boolean;
  seo_title: string; seo_description: string; seo_keywords: string;
  color_ids: number[]; material_ids: number[]; room_ids: number[]; variants: VariantForm[]; specs: SpecForm[];
}

const EMPTY: ProductForm = {
  name: '', slug: '', sku: '', price: null, sale_price: null, stock_status: 'in_stock', category_id: null, short_desc: '',
  description_html: '', dimensions: '', warranty: '', is_featured: false, is_best_seller: false, is_published: true,
  seo_title: '', seo_description: '', seo_keywords: '', color_ids: [], material_ids: [], room_ids: [], variants: [], specs: [],
};

export function toForm(p: ProductDetail): ProductForm {
  return {
    name: p.name, slug: p.slug, sku: p.sku, price: p.price, sale_price: p.sale_price, stock_status: p.stock_status,
    category_id: p.category?.id ?? null, short_desc: p.short_desc ?? '', description_html: p.description_html ?? '',
    dimensions: p.dimensions ?? '', warranty: p.warranty ?? '', is_featured: p.is_featured, is_best_seller: p.is_best_seller,
    is_published: p.is_published, seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '', seo_keywords: p.seo_keywords ?? '',
    color_ids: p.colors.map((c) => c.id), material_ids: p.materials.map((m) => m.id), room_ids: p.rooms.map((r) => r.id),
    variants: p.variants.map((v) => ({ color_id: v.color?.id ?? null, size: v.size ?? '', sku: v.sku ?? '', price_delta: v.price_delta, stock_status: v.stock_status })),
    specs: p.specs.map((s) => ({ ...s })),
  };
}

const nullIfEmpty = (v: string): string | null => (v.trim() ? v.trim() : null);

export function toPayload(f: ProductForm): Record<string, unknown> {
  return {
    name: f.name.trim(), slug: nullIfEmpty(f.slug), sku: f.sku.trim(), price: f.price, sale_price: f.sale_price || null,
    stock_status: f.stock_status, category_id: f.category_id, short_desc: nullIfEmpty(f.short_desc),
    description_html: nullIfEmpty(f.description_html), dimensions: nullIfEmpty(f.dimensions), warranty: nullIfEmpty(f.warranty),
    is_featured: f.is_featured, is_best_seller: f.is_best_seller, is_published: f.is_published,
    seo_title: nullIfEmpty(f.seo_title), seo_description: nullIfEmpty(f.seo_description), seo_keywords: nullIfEmpty(f.seo_keywords),
    color_ids: f.color_ids, material_ids: f.material_ids, room_ids: f.room_ids,
    variants: f.variants.map((v) => ({ color_id: v.color_id, size: nullIfEmpty(v.size), sku: nullIfEmpty(v.sku), price_delta: Number(v.price_delta) || 0, stock_status: v.stock_status })),
    specs: f.specs.filter((s) => s.key.trim() && s.value.trim()).map((s) => ({ key: s.key.trim(), value: s.value.trim() })),
  };
}

@Component({
  selector: 'app-admin-product-form',
  imports: [FormsModule, RouterLink, HtmlEditor, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/products" class="text-sm text-gray-600 hover:underline">← Back to products</a>
    <div class="mb-5 mt-2 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">{{ isNew() ? 'New product' : form.name || 'Edit product' }}</h1>
      @if (!isNew() && slug()) { <a [href]="'/product/' + slug()" target="_blank" class="text-sm text-brand hover:underline">View on site ↗</a> }
    </div>

    <form (submit)="save($event)" class="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div class="space-y-6">
        <section class="card space-y-4 p-5">
          <h2 class="font-semibold">Basics</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2"><label class="label" for="p-name">Name *</label><input id="p-name" name="name" class="input" required [(ngModel)]="form.name" /></div>
            <div><label class="label" for="p-sku">SKU *</label><input id="p-sku" name="sku" class="input" required [(ngModel)]="form.sku" /></div>
            <div><label class="label" for="p-slug">Slug</label><input id="p-slug" name="slug" class="input" placeholder="auto from name" [(ngModel)]="form.slug" /></div>
          </div>
          <div><label class="label" for="p-short">Short description</label><textarea id="p-short" name="short_desc" rows="2" class="input" [(ngModel)]="form.short_desc"></textarea></div>
          <div><span class="label">Full description</span><app-html-editor name="description_html" [(ngModel)]="form.description_html" /></div>
        </section>

        <section class="card space-y-4 p-5">
          <h2 class="font-semibold">Images</h2>
          @if (isNew()) { <p class="text-sm text-gray-500">Save the product first, then upload images.</p> }
          @else {
            <div cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="dropImage($event)" class="flex flex-wrap gap-3">
              @for (img of images(); track img.id; let i = $index) {
                <figure cdkDrag class="w-36 rounded border bg-white p-1.5 text-xs">
                  <div cdkDragHandle class="relative cursor-move">
                    <img [src]="img.thumb_url || img.url" [alt]="img.alt || ''" class="h-28 w-full rounded object-cover" />
                    @if (i === 0) { <span class="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] text-white">Main</span> }
                  </div>
                  <input class="input mt-1 !px-1.5 !py-1 !text-xs" [value]="img.alt || ''" placeholder="Alt text" (change)="setAlt(img, $any($event.target).value)" />
                  <label class="mt-1 flex items-center gap-1"><input type="checkbox" [checked]="img.is_dimension" (change)="setDimension(img, $any($event.target).checked)" /> Dimension drawing</label>
                  <button type="button" class="mt-1 text-red-600 hover:underline" (click)="deleteImage(img)">Remove</button>
                </figure>
              }
            </div>
            <label class="btn-outline cursor-pointer">{{ uploading() ? 'Uploading…' : 'Upload images' }}
              <input type="file" accept="image/*" multiple class="hidden" [disabled]="uploading()" (change)="upload($event)" /></label>
            <p class="text-xs text-gray-500">Drag to reorder — the first image is the main image. Images are converted to WebP with thumbnails.</p>
          }
        </section>

        <section class="card space-y-3 p-5">
          <div class="flex items-center justify-between"><h2 class="font-semibold">Variants</h2>
            <button type="button" class="btn-outline !py-1" (click)="addVariant()">+ Add variant</button></div>
          @for (v of form.variants; track $index; let i = $index) {
            <div class="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_8rem_9rem_auto]">
              <div><label class="label">Colour</label><select class="input" [name]="'v-color-' + i" [(ngModel)]="v.color_id">
                <option [ngValue]="null">—</option>@for (c of options.value()?.colors; track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }</select></div>
              <div><label class="label">Size</label><input class="input" [name]="'v-size-' + i" [(ngModel)]="v.size" /></div>
              <div><label class="label">SKU</label><input class="input" [name]="'v-sku-' + i" [(ngModel)]="v.sku" /></div>
              <div><label class="label">+ Price</label><input type="number" min="0" class="input" [name]="'v-delta-' + i" [(ngModel)]="v.price_delta" /></div>
              <div><label class="label">Stock</label><select class="input" [name]="'v-stock-' + i" [(ngModel)]="v.stock_status">
                @for (s of stockOptions; track s.value) { <option [value]="s.value">{{ s.label }}</option> }</select></div>
              <button type="button" class="pb-2 text-red-600" (click)="form.variants.splice(i, 1)" aria-label="Remove variant">✕</button>
            </div>
          } @empty { <p class="text-sm text-gray-500">No variants. Add colour/size options with an optional price difference.</p> }
        </section>

        <section class="card space-y-3 p-5">
          <div class="flex items-center justify-between"><h2 class="font-semibold">Specifications</h2>
            <button type="button" class="btn-outline !py-1" (click)="form.specs.push({ key: '', value: '' })">+ Add row</button></div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="label" for="p-dim">Dimensions</label><input id="p-dim" name="dimensions" class="input" placeholder="L 210 × W 90 × H 85 cm" [(ngModel)]="form.dimensions" /></div>
            <div><label class="label" for="p-war">Warranty</label><input id="p-war" name="warranty" class="input" [(ngModel)]="form.warranty" /></div>
          </div>
          @for (s of form.specs; track $index; let i = $index) {
            <div class="flex gap-2">
              <input class="input" placeholder="Name (e.g. Finish)" [name]="'s-key-' + i" [(ngModel)]="s.key" />
              <input class="input" placeholder="Value" [name]="'s-val-' + i" [(ngModel)]="s.value" />
              <button type="button" class="text-red-600" (click)="form.specs.splice(i, 1)" aria-label="Remove row">✕</button>
            </div>
          }
        </section>

        <section class="card space-y-4 p-5">
          <h2 class="font-semibold">SEO</h2>
          <div><label class="label" for="p-st">SEO title</label><input id="p-st" name="seo_title" class="input" maxlength="255" [(ngModel)]="form.seo_title" /></div>
          <div><label class="label" for="p-sd">SEO description</label><textarea id="p-sd" name="seo_description" rows="2" maxlength="500" class="input" [(ngModel)]="form.seo_description"></textarea>
            <p class="mt-1 text-xs text-gray-500">{{ form.seo_description.length }}/160 recommended</p></div>
          <div><label class="label" for="p-sk">SEO keywords</label><input id="p-sk" name="seo_keywords" class="input" [(ngModel)]="form.seo_keywords" /></div>
        </section>
      </div>

      <div class="space-y-6">
        <section class="card space-y-3 p-5">
          <h2 class="font-semibold">Publish</h2>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_published" [(ngModel)]="form.is_published" /> Published</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" [(ngModel)]="form.is_featured" /> Featured</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_best_seller" [(ngModel)]="form.is_best_seller" /> Best seller</label>
          @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <div class="flex gap-2">
            <button type="submit" class="btn-primary flex-1" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
            @if (!isNew()) { <button type="button" class="btn-danger" (click)="remove()">Delete</button> }
          </div>
        </section>

        <section class="card space-y-3 p-5">
          <h2 class="font-semibold">Price & stock</h2>
          <div><label class="label" for="p-price">Price *</label><input id="p-price" type="number" min="0" step="0.01" name="price" class="input" required [(ngModel)]="form.price" /></div>
          <div><label class="label" for="p-sale">Sale price</label><input id="p-sale" type="number" min="0" step="0.01" name="sale_price" class="input" [(ngModel)]="form.sale_price" /></div>
          <div><label class="label" for="p-stock">Stock status</label><select id="p-stock" name="stock_status" class="input" [(ngModel)]="form.stock_status">
            @for (s of stockOptions; track s.value) { <option [value]="s.value">{{ s.label }}</option> }</select></div>
        </section>

        <section class="card space-y-3 p-5">
          <h2 class="font-semibold">Organisation</h2>
          <div><label class="label" for="p-cat">Category</label><select id="p-cat" name="category_id" class="input" [(ngModel)]="form.category_id">
            <option [ngValue]="null">— none —</option>@for (c of categoryOptions(); track c.id) { <option [ngValue]="c.id">{{ c.label }}</option> }</select></div>
          <fieldset><legend class="label">Colours</legend><div class="flex flex-wrap gap-2">
            @for (c of options.value()?.colors; track c.id) { <label class="flex items-center gap-1 text-sm"><input type="checkbox" [checked]="form.color_ids.includes(c.id)" (change)="toggleId('color_ids', c.id)" />
              <span class="h-3 w-3 rounded-full border" [style.background]="c.hex_code"></span>{{ c.name }}</label> }</div></fieldset>
          <fieldset><legend class="label">Materials</legend><div class="flex flex-wrap gap-2">
            @for (m of options.value()?.materials; track m.id) { <label class="flex items-center gap-1 text-sm"><input type="checkbox" [checked]="form.material_ids.includes(m.id)" (change)="toggleId('material_ids', m.id)" />{{ m.name }}</label> }</div></fieldset>
          <fieldset><legend class="label">Rooms</legend><div class="flex flex-wrap gap-2">
            @for (r of options.value()?.rooms; track r.id) { <label class="flex items-center gap-1 text-sm"><input type="checkbox" [checked]="form.room_ids.includes(r.id)" (change)="toggleId('room_ids', r.id)" />{{ r.name }}</label> }</div></fieldset>
        </section>
      </div>
    </form>
  `,
})
export class AdminProductForm {
  readonly id = input<string>('new');
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly stockOptions = [
    { value: 'in_stock', label: 'In stock' }, { value: 'out_of_stock', label: 'Out of stock' },
    { value: 'pre_order', label: 'Pre-order' }, { value: 'made_to_order', label: 'Made to order' },
  ];
  protected readonly isNew = computed(() => this.id() === 'new');
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly images = signal<ProductImage[]>([]);
  protected readonly slug = signal('');
  protected form: ProductForm = structuredClone(EMPTY);

  protected readonly options = rxResource({
    stream: () => forkJoin({
      categories: this.api.all<CategoryOption>('categories').pipe(catchError(() => of([] as CategoryOption[]))),
      colors: this.api.list<Color>('colors', { page_size: 100 }).pipe(catchError(() => of({ items: [] as Color[] }))),
      materials: this.api.list<Material>('materials', { page_size: 100 }).pipe(catchError(() => of({ items: [] as Material[] }))),
      rooms: this.api.list<Room>('rooms', { page_size: 100 }).pipe(catchError(() => of({ items: [] as Room[] }))),
    }).pipe(map((r) => ({ categories: r.categories, colors: r.colors.items, materials: r.materials.items, rooms: r.rooms.items }))),
  });

  /** Category select options indented by depth. */
  protected readonly categoryOptions = computed(() => {
    const cats = this.options.value()?.categories ?? [];
    const children = new Map<number | null, CategoryOption[]>();
    cats.forEach((c) => children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c]));
    const out: { id: number; label: string }[] = [];
    const walk = (parent: number | null, depth: number) => (children.get(parent) ?? []).forEach((c) => {
      out.push({ id: c.id, label: `${'— '.repeat(depth)}${c.name}` });
      walk(c.id, depth + 1);
    });
    walk(null, 0);
    return out;
  });

  constructor() {
    effect(() => {
      if (this.isNew()) {
        this.form = structuredClone(EMPTY);
        this.images.set([]);
        return;
      }
      this.api.product(Number(this.id())).subscribe({
        next: (p) => this.load(p),
        error: (e: unknown) => this.error.set(apiError(e, 'Could not load product')),
      });
    });
  }

  private load(p: ProductDetail): void {
    this.form = toForm(p);
    this.images.set(p.images);
    this.slug.set(p.slug);
  }

  protected toggleId(key: 'color_ids' | 'material_ids' | 'room_ids', id: number): void {
    const list = this.form[key];
    this.form[key] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  protected addVariant(): void {
    this.form.variants.push({ color_id: null, size: '', sku: '', price_delta: 0, stock_status: 'in_stock' });
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (!this.form.name.trim() || !this.form.sku.trim() || this.form.price === null) {
      this.error.set('Name, SKU and price are required.');
      return;
    }
    if (this.form.sale_price && this.form.price !== null && this.form.sale_price >= this.form.price) {
      this.error.set('Sale price must be lower than the regular price.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const body = toPayload(this.form);
    const req = this.isNew() ? this.api.createProduct(body) : this.api.updateProduct(Number(this.id()), body);
    req.subscribe({
      next: (p) => {
        this.saving.set(false);
        this.toast.show('Product saved');
        if (this.isNew()) void this.router.navigate(['/admin/products', p.id]);
        else this.load(p);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(apiError(e, 'Could not save'));
      },
    });
  }

  protected remove(): void {
    if (!confirm('Delete this product and its images? This cannot be undone.')) return;
    this.api.remove('products', Number(this.id())).subscribe({
      next: () => {
        this.toast.show('Product deleted');
        void this.router.navigate(['/admin/products']);
      },
      error: (e: unknown) => this.toast.error(apiError(e)),
    });
  }

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    this.uploading.set(true);
    this.api.uploadProductImages(Number(this.id()), files).subscribe({
      next: (p) => {
        this.uploading.set(false);
        this.images.set(p.images);
      },
      error: (e: unknown) => {
        this.uploading.set(false);
        this.toast.error(apiError(e, 'Upload failed'));
      },
    });
  }

  protected dropImage(event: CdkDragDrop<ProductImage[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ordered = [...this.images()];
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    this.images.set(ordered);
    this.api.reorderImages(Number(this.id()), ordered.map((i) => i.id)).subscribe({
      next: (p) => this.images.set(p.images),
      error: (e: unknown) => this.toast.error(apiError(e, 'Could not save order')),
    });
  }

  protected setAlt(img: ProductImage, alt: string): void {
    this.api.updateImage(Number(this.id()), img.id, { alt }).subscribe({
      next: (p) => this.images.set(p.images), error: (e: unknown) => this.toast.error(apiError(e)),
    });
  }

  protected setDimension(img: ProductImage, flag: boolean): void {
    this.api.updateImage(Number(this.id()), img.id, { is_dimension: flag }).subscribe({
      next: (p) => this.images.set(p.images), error: (e: unknown) => this.toast.error(apiError(e)),
    });
  }

  protected deleteImage(img: ProductImage): void {
    if (!confirm('Remove this image?')) return;
    this.api.deleteImage(Number(this.id()), img.id).subscribe({
      next: (p) => this.images.set(p.images), error: (e: unknown) => this.toast.error(apiError(e)),
    });
  }
}
