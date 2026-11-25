import { Component, computed, effect, inject, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth.service";
import { SettingsService } from "./core/settings.service";
import { labelTables } from "./core/responsive-tables";
import { ROLE_LABEL } from "./models";
import { BrandMarkComponent } from "./ui/brand-mark.component";
import { SidebarComponent } from "./ui/sidebar.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, BrandMarkComponent],
  template: `
    @if (auth.user(); as u) {
      <header class="topbar">
        <button type="button" class="btn-ghost btn-sm menu-toggle" (click)="navOpen.set(!navOpen())"
                [attr.aria-expanded]="navOpen()" aria-label="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          Menu
        </button>
        <div class="brand">
          <app-brand-mark />
          <div>
            <span class="brand-name">{{ settings.companyName() }}</span>
            <span class="brand-sub" [attr.title]="settings.motto() || ''">{{ settings.motto() || 'Mine · Mill · Vault' }}</span>
          </div>
        </div>

        <div class="topbar-spacer"></div>

        <div class="user-chip">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="user-meta">
            <span class="user-name">{{ u.name }}</span>
            <span class="user-role">{{ roleLabel() }}</span>
          </div>
        </div>

        <button class="btn-ghost btn-sm" (click)="auth.logout()" aria-label="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span class="logout-label">Logout</span>
        </button>
      </header>
    }
    <div [class.shell]="auth.user()">
      @if (auth.user(); as u) {
        <app-sidebar [role]="u.role" [open]="navOpen()" (closed)="navOpen.set(false)" />
      }
      <main [class]="auth.user() ? 'container' : 'bare'">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  auth = inject(AuthService);
  settings = inject(SettingsService);
  navOpen = signal(false);

  constructor() {
    // Keep table cards on phones labelled as pages change.
    if (typeof document !== "undefined") {
      labelTables();
      new MutationObserver(() => labelTables()).observe(document.body, { childList: true, subtree: true });
    }

    // Reload branding on start-up, and the full settings whenever someone logs in or out.
    effect(() => {
      this.auth.user();
      this.settings.refresh();
    });
  }

  initials = computed(() =>
    (this.auth.user()?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(""),
  );

  roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LABEL[role] : "";
  });
}
