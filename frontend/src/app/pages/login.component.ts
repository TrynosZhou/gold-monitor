import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { PasswordInputComponent } from "../ui/password-input.component";
import { AuthService } from "../core/auth.service";
import { SettingsService } from "../core/settings.service";
import { BrandMarkComponent } from "../ui/brand-mark.component";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [ReactiveFormsModule, PasswordInputComponent, BrandMarkComponent],
  template: `
    <div class="auth-shell">
      <section class="auth-hero">
        <div class="brand">
          <app-brand-mark />
          <div>
            <span class="brand-name">{{ settings.companyName() }}</span>
            @if (settings.motto(); as motto) { <span class="brand-sub" [attr.title]="motto">{{ motto }}</span> }
          </div>
        </div>

        <div class="hero-copy">
          <h1>Every gram,<br /><em>accounted for.</em></h1>
          <p>
            A single, trusted record from the pit to the vault, tracking stone, crushing, gold
            received and cash paid out, with every stage reconciled.
          </p>
        </div>

        <div class="chain" aria-hidden="true">
          <span>Stone</span><i></i><span>Mill</span><i></i><span>Vault</span><i></i><span>Owner</span>
        </div>
      </section>

      <section class="auth-panel">
        <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <div class="eyebrow">Secure access</div>
            <h2>Sign in</h2>
          </div>
          <p class="lede">Enter your credentials to open your dashboard.</p>

          <label>
            Username
            <input formControlName="username" placeholder="Your username" autocomplete="username" />
          </label>

          <label>
            Password
            <app-password-input [control]="form.controls.password" placeholder="Your password" autocomplete="current-password" />
          </label>

          @if (error()) {
            <p class="alert alert-error" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="btn-block" [disabled]="form.invalid || busy()">
            {{ busy() ? "Signing in…" : "Sign in" }}
          </button>

          <p class="auth-foot">Authorised personnel only</p>
        </form>
      </section>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  settings = inject(SettingsService);

  form = this.fb.nonNullable.group({
    username: ["", Validators.required],
    password: ["", Validators.required],
  });

  error = signal("");
  busy = signal(false);

  submit() {
    this.busy.set(true);
    this.error.set("");
    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeRoute()),
      error: (err) => {
        if (err.status === 401) this.error.set("Invalid username or password");
        else if (err.status === 0)
          this.error.set("Cannot reach the server. Check that the backend is running on port 3000.");
        else this.error.set(err.error?.message ?? "Server error. Check the backend terminal for details.");
        this.busy.set(false);
      },
    });
  }
}
