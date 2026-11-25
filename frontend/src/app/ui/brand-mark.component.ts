import { Component, inject } from "@angular/core";
import { SettingsService } from "../core/settings.service";

/** The company logo, or the default Gold Monitor mark when none has been uploaded. */
@Component({
  selector: "app-brand-mark",
  standalone: true,
  template: `
    @if (settings.logo(); as src) {
      <img class="brand-logo" [src]="src" [alt]="settings.companyName() + ' logo'" />
    } @else {
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#16295c" stroke="#2563eb" stroke-opacity=".55" />
        <path d="M12 43l7-17h26l7 17z" fill="#7fb0ff" />
        <path d="M19 26h26l-3.2 7.5H22.2z" fill="#dbe8ff" />
        <path d="M12 43h40" stroke="#1d4ed8" stroke-width="2" />
      </svg>
    }
  `,
})
export class BrandMarkComponent {
  settings = inject(SettingsService);
}
