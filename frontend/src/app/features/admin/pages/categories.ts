import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { CategoryNode } from '../../../core/models';
import { Dialog } from '../../../core/dialog';
import { Toast } from '../../../core/toast';
import { AdminApi, apiError } from '../core/admin-api';
import { HtmlEditor } from '../ui/html-editor';
import { ImageInput } from '../ui/image-input';

interface CategoryForm {
  id: number | null; name: string; slug: string; parent_id: number | null; description_html: string; image: string | null;
  banner_image: string | null; sort_order: number; is_active: boolean; show_in_menu: boolean; is_featured: boolean;
  seo_title: string; seo_description: string; seo_keywords: string;
}

const blank = (parent: number | null = null): CategoryForm => ({
  id: null, name: '', slug: '', parent_id: parent, description_html: '', image: null, banner_image: null, sort_order: 0,
  is_active: true, show_in_menu: true, is_featured: false, seo_title: '', seo_description: '', seo_keywords: '',
});

/** Flatten a tree for the parent dropdown, excluding a node and its descendants (prevents cycles). */
export function flattenTree(nodes: CategoryNode[], exclude: number | null, depth = 0): { id: number; label: string }[] {
  return nodes.flatMap((n) => (n.id === exclude ? [] : [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` }, ...flattenTree(n.children, exclude, depth + 1),
  ]));
}

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule, NgTemplateOutlet, HtmlEditor, ImageInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Categories</h1>
      <button type="button" class="btn-primary" (click)="edit(null)">+ New category</button>
    </div>
    <div class="grid gap-6 xl:grid-cols-[1fr_32rem]">
      <section class="card p-4">
        <p class="mb-3 text-xs text-gray-500">Top level = room/department → category → subcategory. Counts include published products in subcategories.</p>
        <ul class="text-sm"><ng-container [ngTemplateOutlet]="branch" [ngTemplateOutletContext]="{ nodes: tree.value() ?? [] }" /></ul>
        @if (!tree.value()?.length && !tree.isLoading()) { <p class="text-gray-500">No categories yet.</p> }
      </section>

      @if (form(); as f) {
        <form class="card h-fit space-y-3 p-5" (submit)="save($event)">
          <h2 class="font-semibold">{{ f.id ? 'Edit category' : 'New category' }}</h2>
          <div><label class="label" for="c-name">Name *</label><input id="c-name" name="name" class="input" required [(ngModel)]="f.name" /></div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div><label class="label" for="c-slug">Slug</label><input id="c-slug" name="slug" class="input" placeholder="auto" [(ngModel)]="f.slug" /></div>
            <div><label class="label" for="c-sort">Sort order</label><input id="c-sort" type="number" name="sort_order" class="input" [(ngModel)]="f.sort_order" /></div>
          </div>
          <div><label class="label" for="c-parent">Parent</label><select id="c-parent" name="parent_id" class="input" [(ngModel)]="f.parent_id">
            <option [ngValue]="null">— top level —</option>@for (o of parentOptions(); track o.id) { <option [ngValue]="o.id">{{ o.label }}</option> }</select></div>
          <div class="flex flex-wrap gap-4 text-sm">
            <label class="flex items-center gap-1"><input type="checkbox" name="is_active" [(ngModel)]="f.is_active" /> Active</label>
            <label class="flex items-center gap-1"><input type="checkbox" name="show_in_menu" [(ngModel)]="f.show_in_menu" /> In menu</label>
            <label class="flex items-center gap-1"><input type="checkbox" name="is_featured" [(ngModel)]="f.is_featured" /> Featured on home</label>
          </div>
          <div><span class="label">Thumbnail</span><app-image-input name="image" folder="categories" [(ngModel)]="f.image" /></div>
          <div><span class="label">Banner</span><app-image-input name="banner_image" folder="categories" [(ngModel)]="f.banner_image" /></div>
          <div><span class="label">Description (shown under the product grid)</span><app-html-editor name="description_html" [(ngModel)]="f.description_html" /></div>
          <div><label class="label" for="c-st">SEO title</label><input id="c-st" name="seo_title" class="input" [(ngModel)]="f.seo_title" /></div>
          <div><label class="label" for="c-sd">SEO description</label><textarea id="c-sd" name="seo_description" rows="2" class="input" [(ngModel)]="f.seo_description"></textarea></div>
          <div><label class="label" for="c-sk">SEO keywords</label><input id="c-sk" name="seo_keywords" class="input" [(ngModel)]="f.seo_keywords" /></div>
          @if (error()) { <p class="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <div class="flex gap-2">
            <button type="submit" class="btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
            <button type="button" class="btn-outline" (click)="form.set(null)">Cancel</button>
            @if (f.id) { <button type="button" class="btn-danger ml-auto" (click)="remove(f.id)">Delete</button> }
          </div>
        </form>
      }
    </div>

    <ng-template #branch let-nodes="nodes">
      @for (n of nodes; track n.id) {
        <li class="py-0.5">
          <div class="group flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50" [class.bg-brand/10]="form()?.id === n.id">
            <button type="button" class="flex-1 text-left" [class.text-gray-400]="!n.is_active" (click)="edit(n.id)">{{ n.name }}</button>
            <span class="text-xs text-gray-400">{{ n.product_count }}</span>
            <button type="button" class="text-xs text-brand opacity-0 group-hover:opacity-100" (click)="edit(null, n.id)">+ sub</button>
          </div>
          @if (n.children.length) { <ul class="ml-4 border-l pl-2"><ng-container [ngTemplateOutlet]="branch" [ngTemplateOutletContext]="{ nodes: n.children }" /></ul> }
        </li>
      }
    </ng-template>
  `,
})
export class AdminCategories {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(Toast);

  protected readonly tree = rxResource({ stream: () => this.api.all<CategoryNode>('categories/tree') });
  protected readonly form = signal<CategoryForm | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly parentOptions = computed(() => flattenTree(this.tree.value() ?? [], this.form()?.id ?? null));

  protected edit(id: number | null, parent: number | null = null): void {
    this.error.set(null);
    if (id === null) {
      this.form.set(blank(parent));
      return;
    }
    this.api.get<CategoryForm & Record<string, unknown>>('categories', id).subscribe({
      next: (c) => this.form.set({
        ...blank(), ...c, slug: c.slug ?? '', description_html: (c.description_html as string) ?? '',
        seo_title: c.seo_title ?? '', seo_description: c.seo_description ?? '', seo_keywords: c.seo_keywords ?? '',
      }),
      error: (e: unknown) => this.toast.error(apiError(e)),
    });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const f = this.form();
    if (!f || !f.name.trim()) return;
    const { id, ...rest } = f;
    const body = {
      ...rest, name: rest.name.trim(), slug: rest.slug.trim() || null, sort_order: Number(rest.sort_order) || 0,
      seo_title: rest.seo_title || null, seo_description: rest.seo_description || null, seo_keywords: rest.seo_keywords || null,
    };
    this.saving.set(true);
    const req = id ? this.api.update('categories', id, body) : this.api.create('categories', body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Category saved');
        this.form.set(null);
        this.tree.reload();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(apiError(e, 'Could not save'));
      },
    });
  }

  protected async remove(id: number): Promise<void> {
    if (!(await this.dialog.confirm('Delete category', 'Delete this category? Its subcategories move up one level.', { confirmLabel: 'Delete', kind: 'danger' }))) return;
    this.api.remove('categories', id).subscribe({
      next: () => {
        this.toast.show('Category deleted');
        this.form.set(null);
        this.tree.reload();
      },
      error: (e: unknown) => this.error.set(apiError(e)),
    });
  }
}
