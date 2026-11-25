import { Component, ElementRef, OnInit, ViewChild, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { SettingsService } from "../core/settings.service";
import { AppSettings } from "../models";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 1.5 * 1024 * 1024;

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "ZWG", name: "Zimbabwe Gold (ZiG)" },
  { code: "ZAR", name: "South African Rand" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "AED", name: "UAE Dirham" },
  { code: "INR", name: "Indian Rupee" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Administrator settings: company identity, currency and gold selling prices. */
@Component({
  selector: "app-settings-form",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="panel" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="panel-head">
        <div>
          <h3>Company settings</h3>
          <p>These details appear in the header, on the login screen, in the browser tab and on every PDF report.</p>
        </div>
      </div>

      <div class="panel-body">
        <h4 class="section-title">Company identity</h4>

        <label>
          Company name
          <input formControlName="companyName" maxlength="120" placeholder="e.g. Sunrise Gold Co" />
          @if (form.controls.companyName.invalid && form.controls.companyName.touched) {
            <span class="field-error">Enter a company name (up to 120 characters).</span>
          }
        </label>

        <label>
          Company motto
          <input formControlName="motto" maxlength="200" placeholder="Optional, e.g. Every gram, accounted for" />
          <span class="hint">Shown under the company name in place of “Mine · Mill · Vault”.</span>
        </label>

        <div class="field">
          <span class="field-label">Company logo</span>
          <div class="logo-field">
            @if (logo(); as src) {
              <img class="logo-preview" [src]="src" alt="Current company logo" />
            } @else {
              <div class="logo-preview logo-empty" aria-hidden="true">No logo</div>
            }
            <div class="logo-actions">
              <button type="button" class="btn-ghost btn-sm" (click)="logoInput.click()">
                {{ logo() ? "Replace logo" : "Upload logo" }}
              </button>
              @if (logo()) {
                <button type="button" class="btn-ghost btn-sm" (click)="removeLogo()">Remove logo</button>
              }
              <input #logoInput type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml"
                     (change)="onLogoSelected($event)" />
            </div>
          </div>
          <span class="hint">PNG, JPEG, WebP or SVG, up to 1.5 MB. A square image works best.</span>
          @if (logoError()) { <span class="field-error">{{ logoError() }}</span> }
        </div>

        <h4 class="section-title">Currency</h4>

        <label>
          Currency for all money figures
          <select formControlName="currency">
            @for (c of currencies(); track c.code) {
              <option [value]="c.code">{{ c.code }} · {{ c.name }}</option>
            }
          </select>
          <span class="hint">Applies to cash payouts, dashboards and reports. Payouts already recorded keep the currency they were paid in.</span>
        </label>

        <h4 class="section-title">Gold selling price</h4>

        <div class="form-row">
          <label>
            Price per gram ({{ form.controls.currency.value }})
            <input type="number" step="0.01" min="0.01" formControlName="goldPricePerGram"
                   (input)="onGramInput($any($event.target).value)" />
          </label>
          <label>
            Price per kilogram ({{ form.controls.currency.value }})
            <input type="number" step="0.01" min="0.01" formControlName="goldPricePerKg"
                   (input)="onKgInput($any($event.target).value)" />
          </label>
        </div>
        <span class="hint">The two prices update each other as you type. The per-gram price pre-fills the sale form.</span>

        <button type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? "Saving…" : "Save settings" }}
        </button>

        @if (message()) {
          <p class="alert" [class.alert-ok]="!isError()" [class.alert-error]="isError()" role="status">{{ message() }}</p>
        }
      </div>
    </form>
  `,
})
export class SettingsFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(SettingsService);

  @ViewChild("logoInput") logoInput!: ElementRef<HTMLInputElement>;

  form = this.fb.nonNullable.group({
    companyName: ["", [Validators.required, Validators.maxLength(120)]],
    motto: ["", Validators.maxLength(200)],
    currency: ["USD", Validators.required],
    goldPricePerGram: [0, [Validators.required, Validators.min(0.01)]],
    goldPricePerKg: [0, [Validators.required, Validators.min(0.01)]],
  });

  currencies = signal(CURRENCIES);
  logo = signal<string | null>(null);
  logoError = signal("");
  saving = signal(false);
  message = signal("");
  isError = signal(false);
  private logoChanged = false;

  ngOnInit() {
    this.svc.fetchFull().subscribe((s) => this.fill(s));
  }

  private fill(s: AppSettings) {
    this.form.reset({
      companyName: s.companyName,
      motto: s.motto ?? "",
      currency: s.currency,
      goldPricePerGram: s.goldPricePerGram,
      goldPricePerKg: s.goldPricePerKg,
    });
    if (!CURRENCIES.some((c) => c.code === s.currency)) {
      this.currencies.set([...CURRENCIES, { code: s.currency, name: "Current currency" }]);
    }
    this.logo.set(s.logoDataUrl);
    this.logoChanged = false;
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!LOGO_TYPES.includes(file.type)) {
      this.logoError.set("Choose a PNG, JPEG, WebP or SVG image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      this.logoError.set("That image is larger than 1.5 MB. Choose a smaller one.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.logo.set(reader.result as string);
      this.logoChanged = true;
      this.logoError.set("");
    };
    reader.onerror = () => this.logoError.set("The image could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logo.set(null);
    this.logoChanged = true;
    this.logoError.set("");
  }

  onGramInput(value: string) {
    const grams = parseFloat(value);
    if (!isNaN(grams)) this.form.controls.goldPricePerKg.setValue(round2(grams * 1000), { emitEvent: false });
  }

  onKgInput(value: string) {
    const kg = parseFloat(value);
    if (!isNaN(kg)) this.form.controls.goldPricePerGram.setValue(round2(kg / 1000), { emitEvent: false });
  }

  save() {
    if (this.form.invalid || this.logoError()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: Partial<AppSettings> = {
      companyName: v.companyName.trim(),
      motto: v.motto.trim() || null,
      currency: v.currency,
      goldPricePerGram: Number(v.goldPricePerGram),
      goldPricePerKg: Number(v.goldPricePerKg),
    };
    // Only send the logo when it changed, so saving other fields never resends a large image.
    if (this.logoChanged) body.logoDataUrl = this.logo();

    this.saving.set(true);
    this.message.set("");
    this.svc.save(body).subscribe({
      next: (s) => {
        this.fill(s);
        this.saving.set(false);
        this.isError.set(false);
        this.message.set("Settings saved. The new details now apply across the app.");
      },
      error: (err) => {
        this.saving.set(false);
        this.isError.set(true);
        this.message.set(err.error?.message ?? "Settings could not be saved");
      },
    });
  }
}
