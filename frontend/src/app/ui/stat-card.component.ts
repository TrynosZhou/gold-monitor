import { Component, Input } from "@angular/core";

export type StatIcon = "gold" | "stone" | "vault" | "cash" | "clock" | "alert" | "check" | "chart" | "list";
export type StatTone = "blue" | "stone" | "ok" | "warn";

@Component({
  selector: "app-stat-card",
  standalone: true,
  template: `
    <div class="stat" [attr.data-tone]="tone">
      <div class="stat-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          @switch (icon) {
            @case ("gold") { <path d="M3.5 18.5 6.8 9.5h10.4l3.3 9z" /><path d="M6.8 9.5 8 6h8l1.2 3.5" /> }
            @case ("stone") { <path d="m3 19 5.2-9.2 3.6 5 3-4L21 19z" /> }
            @case ("vault") { <rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="12" cy="12" r="3.6" /><path d="M12 8.4v-1M12 16.6v1M8.4 12h-1M16.6 12h1" /> }
            @case ("cash") { <rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /> }
            @case ("clock") { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /> }
            @case ("alert") { <path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.01" /> }
            @case ("check") { <circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.2 9.5" /> }
            @case ("chart") { <path d="M3 12h4l3-8 4 16 3-8h4" /> }
            @default { <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /> }
          }
        </svg>
      </div>
      <div class="stat-body">
        <span class="stat-label">{{ label }}</span>
        <span class="stat-value">{{ value ?? "—" }}@if (unit && value !== null && value !== undefined) {<small>{{ unit }}</small>}</span>
        @if (hint) { <span class="stat-hint">{{ hint }}</span> }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) label = "";
  @Input() value: string | number | null | undefined;
  @Input() unit = "";
  @Input() hint = "";
  @Input() icon: StatIcon = "gold";
  @Input() tone: StatTone = "blue";
}
