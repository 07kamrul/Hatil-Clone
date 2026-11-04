import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS: Record<string, string> = {
  facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm5.5-9.5h.01',
  youtube: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm7 1v6l5-3z',
  linkedin: 'M4 9h4v11H4zM6 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 9h4v2a4 4 0 0 1 7 2.5V20h-4v-6a2 2 0 0 0-4 0v6h-3z',
  heart: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  compare: 'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 13l4 4L19 7',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  tag: 'M3 12V4h8l9 9-8 8-9-9zM7.5 8a.5.5 0 1 0 0-.01',
  image: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7M22 21c0-3.5-2.5-5.5-5-5.5',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z',
  inbox: 'M4 4h16v12h-5a3 3 0 0 1-6 0H4zM4 12l4-4h8l4 4',
  logout: 'M15 4h5v16h-5M10 8l4 4-4 4M14 12H3',
  external: 'M14 4h6v6M20 4l-9 9M18 13v7H4V6h7',
  pencil: 'M4 20l4-1L20 7l-3-3L5 16l-1 4z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M4 4l16 16M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.2 7.3A16.5 16.5 0 0 0 2 11s3.5 6 10 6c1.3 0 2.4-.2 3.4-.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  chat: 'M4 5h16v11H9l-5 4z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  doc: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @if (name() === 'whatsapp') {
        <path d="M21 12a9 9 0 0 1-13.2 8L3 21l1.1-4.6A9 9 0 1 1 21 12z" />
        <path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-.8-.4-1.600-1.200-2-2l.8-1-1-2z" />
      } @else {
        <path [attr.d]="path()" />
      }
    </svg>
  `,
  host: { class: 'inline-flex shrink-0 align-middle' },
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(20);
  protected readonly path = computed(() => PATHS[this.name()] ?? '');
}
