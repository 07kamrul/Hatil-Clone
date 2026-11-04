import {
  ChangeDetectionStrategy, Component, ElementRef, effect, forwardRef, inject, signal, untracked, viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Dialog } from '../../../core/dialog';

interface ToolbarButton { label: string; title: string; command: string; arg?: string }

const TOOLBAR: ToolbarButton[] = [
  { label: 'B', title: 'Bold', command: 'bold' },
  { label: 'I', title: 'Italic', command: 'italic' },
  { label: 'H2', title: 'Heading', command: 'formatBlock', arg: 'h2' },
  { label: 'H3', title: 'Subheading', command: 'formatBlock', arg: 'h3' },
  { label: 'P', title: 'Paragraph', command: 'formatBlock', arg: 'p' },
  { label: '• List', title: 'Bulleted list', command: 'insertUnorderedList' },
  { label: '1. List', title: 'Numbered list', command: 'insertOrderedList' },
];

/**
 * Lightweight rich-text editor (contenteditable + HTML source view). Output is sanitised server-side,
 * so the editor only needs to produce reasonable markup.
 */
@Component({
  selector: 'app-html-editor',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HtmlEditor), multi: true }],
  template: `
    <div class="min-w-0 max-w-full overflow-hidden rounded-md border border-gray-300 focus-within:border-brand">
      <div class="flex flex-wrap gap-1 border-b bg-gray-50 p-1" role="toolbar" aria-label="Formatting">
        @for (b of toolbar; track b.label) {
          <button type="button" class="inline-flex min-h-10 min-w-10 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" [title]="b.title"
                  [disabled]="source()" (mousedown)="$event.preventDefault()" (click)="exec(b)">{{ b.label }}</button>
        }
        <button type="button" class="inline-flex min-h-10 min-w-10 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" title="Link" [disabled]="source()"
                (mousedown)="$event.preventDefault()" (click)="link()">Link</button>
        <button type="button" class="ml-auto inline-flex min-h-10 items-center rounded px-3 text-xs hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none" (click)="toggleSource()">{{ source() ? 'Visual' : 'HTML' }}</button>
      </div>
      @if (source()) {
        <textarea class="block min-h-48 w-full p-3 font-mono text-xs focus:outline-none" [ngModel]="html()" (ngModelChange)="setFromSource($event)" (blur)="touched()"></textarea>
      } @else {
        <div #editable contenteditable="true" class="prose-content min-h-48 overflow-x-auto break-words p-3 text-sm focus:outline-none [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto" (input)="onInput()" (blur)="touched()"></div>
      }
    </div>
  `,
})
export class HtmlEditor implements ControlValueAccessor {
  private readonly dialog = inject(Dialog);
  protected readonly toolbar = TOOLBAR;
  protected readonly source = signal(false);
  protected readonly html = signal('');
  private readonly editable = viewChild<ElementRef<HTMLDivElement>>('editable');
  private onChange: (value: string) => void = () => undefined;
  protected touched: () => void = () => undefined;

  constructor() {
    // Push the model into the editable div whenever it (re)appears or the value changes externally.
    effect(() => {
      const el = this.editable()?.nativeElement;
      const value = untracked(() => this.html());
      if (el && el.innerHTML !== value) el.innerHTML = value;
    });
  }

  writeValue(value: string | null): void {
    this.html.set(value ?? '');
    const el = this.editable()?.nativeElement;
    if (el) el.innerHTML = value ?? '';
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }

  protected onInput(): void {
    const value = this.editable()?.nativeElement.innerHTML ?? '';
    this.html.set(value);
    this.onChange(value);
  }

  protected setFromSource(value: string): void {
    this.html.set(value);
    this.onChange(value);
  }

  protected exec(b: ToolbarButton): void {
    // execCommand is deprecated but remains the only dependency-free way to format contenteditable.
    document.execCommand(b.command, false, b.arg);
    this.onInput();
  }

  protected async link(): Promise<void> {
    const url = await this.dialog.prompt('Insert link', {
      placeholder: 'https://…',
      validate: (v) => (/^(https?:\/\/|mailto:|tel:|\/)\S+$/i.test(v.trim()) ? '' : 'Enter a valid URL (https://…, mailto:, tel: or /path)'),
    });
    if (url) {
      document.execCommand('createLink', false, url.trim());
      this.onInput();
    }
  }

  protected toggleSource(): void {
    this.source.update((v) => !v);
  }
}
