import { Component, Input } from "@angular/core";
import { DatePipe } from "@angular/common";

@Component({
  selector: "app-page-header",
  standalone: true,
  imports: [DatePipe],
  template: `
    <header class="page-head">
      <div>
        <div class="eyebrow">{{ eyebrow }}</div>
        <h2>{{ title }}</h2>
        @if (subtitle) { <p class="page-sub">{{ subtitle }}</p> }
      </div>
      <div class="page-tools">
        <ng-content />
        <span class="date-pill">{{ today | date: "EEEE, d MMMM y" }}</span>
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() eyebrow = "";
  @Input({ required: true }) title = "";
  @Input() subtitle = "";
  today = new Date();
}
