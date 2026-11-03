import { Pipe, PipeTransform, inject } from '@angular/core';

import { SettingsStore } from '../../core/settings-store';
import { formatMoney } from '../../core/whatsapp';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsStore);

  transform(value: number | null | undefined): string {
    return formatMoney(value ?? 0, this.settings.settings().currency_symbol);
  }
}
