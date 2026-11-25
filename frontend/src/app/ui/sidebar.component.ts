import { NgTemplateOutlet } from "@angular/common";
import { Component, EventEmitter, Input, Output, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from "@angular/router";
import { filter, map } from "rxjs";
import { NAV, NavGroup, ROLE_BASE } from "../core/nav";
import { Role } from "../models";

/** Role-based sidebar with menus and collapsible sub menus. */
@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
  template: `
    <aside class="sidebar" [class.is-open]="open" aria-label="Main navigation">
      <nav>
        <ul class="nav-list">
          @for (g of groups; track g.key) {
            <li>
              @if (g.id) {
                <a class="nav-item" [routerLink]="link(g.id)" routerLinkActive="is-active" (click)="closed.emit()">
                  <ng-container *ngTemplateOutlet="icon; context: { $implicit: g.icon }" />
                  <span>{{ g.label }}</span>
                </a>
              } @else {
                <button type="button" class="nav-item nav-group" [class.has-active]="hasActive(g)"
                        [attr.aria-expanded]="isOpen(g)" (click)="toggle(g)">
                  <ng-container *ngTemplateOutlet="icon; context: { $implicit: g.icon }" />
                  <span>{{ g.label }}</span>
                  <svg class="chev" [class.up]="isOpen(g)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                @if (isOpen(g)) {
                  <ul class="sub-list">
                    @for (c of g.children; track c.id) {
                      <li>
                        <a class="sub-item" [routerLink]="link(c.id)" routerLinkActive="is-active" (click)="closed.emit()">{{ c.label }}</a>
                      </li>
                    }
                  </ul>
                }
              }
            </li>
          }
        </ul>
      </nav>
    </aside>
    @if (open) { <div class="sidebar-backdrop" (click)="closed.emit()"></div> }

    <ng-template #icon let-name>
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (name) {
          @case ("home") { <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /> }
          @case ("stone") { <path d="m3 19 5.2-9.2 3.6 5 3-4L21 19z" /> }
          @case ("mill") { <circle cx="12" cy="12" r="3.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /> }
          @case ("vault") { <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.4" /> }
          @case ("cash") { <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /> }
          @case ("report") { <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /> }
          @case ("lock") { <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /> }
          @case ("scale") { <path d="M12 4v16M6 20h12M5 7h14" /><path d="M5 7 2.5 13a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z" /> }
          @case ("gear") { <circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" /> }
          @default { <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /> }
        }
      </svg>
    </ng-template>
  `,
})
export class SidebarComponent {
  @Input({ required: true }) role!: Role;
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  private router = inject(Router);
  private url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** Groups the user has explicitly opened or closed. */
  private manual = signal<Record<string, boolean>>({});

  get groups(): NavGroup[] {
    return NAV[this.role];
  }

  link(id: string) {
    return `${ROLE_BASE[this.role]}/${id}`;
  }

  hasActive(g: NavGroup): boolean {
    const path = this.url().split("?")[0];
    return (g.children ?? []).some((c) => path === this.link(c.id));
  }

  isOpen(g: NavGroup): boolean {
    return this.manual()[g.key] ?? this.hasActive(g);
  }

  toggle(g: NavGroup) {
    this.manual.update((m) => ({ ...m, [g.key]: !this.isOpen(g) }));
  }
}
