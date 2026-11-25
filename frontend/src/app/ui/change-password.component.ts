import { Component, inject, signal } from "@angular/core";
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from "@angular/forms";
import { PasswordInputComponent } from "./password-input.component";
import { AuthService } from "../core/auth.service";

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const next = group.get("newPassword")?.value;
  const confirm = group.get("confirmPassword")?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

/** Change-password form, shown on every role's dashboard (section "password"). */
@Component({
  selector: "app-change-password",
  standalone: true,
  imports: [ReactiveFormsModule, PasswordInputComponent],
  template: `
    <form class="panel pw-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="panel-head">
        <div>
          <h3>Change password</h3>
          <p>Enter your current password, then choose a new one.</p>
        </div>
      </div>
      <div class="panel-body">
        <!-- Hidden username so browsers/password managers can associate the new password with the account -->
        <input type="text" name="username" autocomplete="username" [value]="auth.user()?.name ?? ''"
               readonly tabindex="-1" aria-hidden="true"
               style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" />
        <label>
          Current password
          <app-password-input [control]="form.controls.currentPassword" autocomplete="current-password" />
        </label>
        <label>
          New password
          <app-password-input [control]="form.controls.newPassword" autocomplete="new-password" />
          <span class="hint">At least 8 characters, different from your current password.</span>
        </label>
        <label>
          Confirm new password
          <app-password-input [control]="form.controls.confirmPassword" autocomplete="new-password" />
        </label>
        @if (form.hasError("mismatch") && form.controls.confirmPassword.dirty) {
          <p class="alert alert-error" role="alert">The new passwords do not match.</p>
        }
        <button type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? "Saving…" : "Change password" }}
        </button>
        @if (message()) {
          <p class="alert" [class.alert-ok]="!isError()" [class.alert-error]="isError()" role="status">{{ message() }}</p>
        }
      </div>
    </form>
  `,
})
export class ChangePasswordComponent {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);

  saving = signal(false);
  message = signal("");
  isError = signal(false);

  form = this.fb.nonNullable.group(
    {
      currentPassword: ["", Validators.required],
      newPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", Validators.required],
    },
    { validators: matchPasswords },
  );

  submit() {
    if (this.form.invalid) return;
    const { currentPassword, newPassword } = this.form.getRawValue();
    if (currentPassword === newPassword) {
      this.isError.set(true);
      this.message.set("The new password must be different from the current one.");
      return;
    }
    this.saving.set(true);
    this.message.set("");
    this.isError.set(false);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.message.set("Password changed successfully");
        this.form.reset();
        this.saving.set(false);
      },
      error: (err) => {
        this.message.set(err.error?.message ?? "Could not change password");
        this.isError.set(true);
        this.saving.set(false);
      },
    });
  }
}
