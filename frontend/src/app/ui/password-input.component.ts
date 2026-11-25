import { Component, Input, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

/** Password textbox with an eye icon that toggles between hidden and visible. */
@Component({
  selector: "app-password-input",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="input-wrap">
      <input
        [formControl]="control"
        [type]="visible() ? 'text' : 'password'"
        [attr.placeholder]="placeholder || null"
        [attr.autocomplete]="autocomplete"
      />
      <button
        type="button"
        class="eye-toggle"
        (click)="visible.set(!visible())"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [attr.aria-pressed]="visible()"
        [title]="visible() ? 'Hide password' : 'Show password'"
      >
        @if (visible()) {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-10-8-10-8a17.7 17.7 0 0 1 4.1-5.4M9.9 4.2A9.6 9.6 0 0 1 12 4c7 0 10 8 10 8a17.8 17.8 0 0 1-2.2 3.3M1 1l22 22M14.1 14.1a3 3 0 1 1-4.2-4.2" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        }
      </button>
    </div>
  `,
})
export class PasswordInputComponent {
  @Input({ required: true }) control!: FormControl<string>;
  @Input() placeholder = "";
  @Input() autocomplete = "current-password";
  visible = signal(false);
}
