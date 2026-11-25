import { Component, Input } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { Summary } from "../models";

interface Step {
  label: string;
  grams: number | undefined;
  diff: number | null | undefined; // difference from previous stage (null for first stage)
}

@Component({
  selector: "app-reconciliation",
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Reconciliation</h3>
          <p>Gold traced through every stage, from the mill to the owner. Each stage should match the one before it.</p>
        </div>
      </div>

      <ol class="recon">
        @for (s of steps; track s.label; let i = $index) {
          <li class="recon-step">
            <span class="recon-num">{{ i + 1 }}</span>
            <span class="recon-label">{{ s.label }}</span>
            <span class="recon-value">{{ s.grams | number: "1.3-3" }}<small>g</small></span>
            @if (s.diff === null) {
              <span class="badge recon-diff">Starting stage</span>
            } @else if (isZero(s.diff)) {
              <span class="badge badge-ok recon-diff">Matches previous</span>
            } @else {
              <span class="badge badge-warn recon-diff">Variance {{ s.diff | number: "1.3-3" }} g</span>
            }
          </li>
        }
      </ol>

      <div class="recon-banner" [class.is-ok]="summary?.reconciliation?.isFullyMatched" [class.is-warn]="!summary?.reconciliation?.isFullyMatched">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          @if (summary?.reconciliation?.isFullyMatched) {
            <circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.2 9.5" />
          } @else {
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12.5M12 16v.01" />
          }
        </svg>
        <span>
          {{ summary?.reconciliation?.isFullyMatched
              ? "Balanced: produced = received = sold = confirmed"
              : "Not balanced yet" }}
        </span>
      </div>
    </section>
  `,
})
export class ReconciliationComponent {
  @Input() summary: Summary | null = null;

  get steps(): Step[] {
    const s = this.summary;
    return [
      { label: "Produced by miller", grams: s?.goldProduced, diff: null },
      { label: "Received by manager", grams: s?.goldReceived, diff: s?.reconciliation?.producedVsReceived },
      { label: "Sold / sent to owner", grams: s?.goldSold, diff: s?.reconciliation?.receivedVsSold },
      { label: "Confirmed by owner", grams: s?.goldConfirmedByOwner, diff: s?.reconciliation?.soldVsConfirmed },
    ];
  }

  isZero(n: number | undefined | null): boolean {
    return Math.abs(n ?? 0) <= 0.001;
  }
}
