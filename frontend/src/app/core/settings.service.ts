import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Observable, tap } from "rxjs";
import { ApiService } from "./api.service";
import { AuthService } from "./auth.service";
import { AppSettings, Branding } from "../models";

const DEFAULTS: AppSettings = {
  companyName: "Gold Monitor",
  motto: null,
  logoDataUrl: null,
  currency: "USD",
  goldPricePerGram: 0,
  goldPricePerKg: 0,
};

/**
 * Holds the company settings for the whole app. Branding is loaded for every
 * visitor; gold prices are added once someone is logged in.
 */
@Injectable({ providedIn: "root" })
export class SettingsService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private title = inject(Title);

  readonly settings = signal<AppSettings>(DEFAULTS);

  readonly companyName = computed(() => this.settings().companyName || DEFAULTS.companyName);
  readonly motto = computed(() => this.settings().motto);
  readonly logo = computed(() => this.settings().logoDataUrl);
  readonly currency = computed(() => this.settings().currency || "USD");
  readonly goldPricePerGram = computed(() => this.settings().goldPricePerGram);
  readonly goldPricePerKg = computed(() => this.settings().goldPricePerKg);

  constructor() {
    // Keep the browser tab title in step with the company name.
    effect(() => this.title.setTitle(this.companyName()));
  }

  /** Reloads branding, and the full settings when someone is logged in. */
  refresh() {
    this.api.get<Branding>("/settings/branding").subscribe({
      next: (b) => this.settings.update((s) => ({ ...s, ...b })),
      error: () => {},
    });
    if (this.auth.token()) {
      this.fetchFull().subscribe({ error: () => {} });
    }
  }

  fetchFull(): Observable<AppSettings> {
    return this.api.get<AppSettings>("/settings").pipe(tap((s) => this.settings.set(s)));
  }

  save(body: Partial<AppSettings>): Observable<AppSettings> {
    return this.api.put<AppSettings>("/settings", body).pipe(tap((s) => this.settings.set(s)));
  }
}
