import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'green' | 'gray' | 'brand' | 'red' | 'amber';

const TONES: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  gray: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  brand: 'bg-brand/10 text-brand-dark ring-brand/30',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

/** Small pill label for statuses and roles. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset" [class]="tones()">
      <ng-content />
    </span>
  `,
})
export class Badge {
  readonly tone = input<BadgeTone>('gray');
  protected readonly tones = () => TONES[this.tone()];
}
