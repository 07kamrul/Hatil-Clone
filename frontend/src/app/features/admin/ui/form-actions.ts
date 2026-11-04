import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Form action row (Save / Cancel / Delete). On phones it docks to the bottom of the
 * viewport as a sticky save bar; from `md` up it renders inline at the end of the form.
 * The admin layout reserves bottom padding on small screens so content is never hidden.
 */
@Component({
  selector: 'app-form-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'sticky-bar flex flex-wrap items-center gap-2 [&>*]:flex-1 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none md:[&>*]:flex-none',
  },
  template: `<ng-content />`,
})
export class FormActions {}
