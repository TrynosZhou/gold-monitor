import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CurrencyPipe, DatePipe, DecimalPipe } from "@angular/common";
import { ApiService } from "../core/api.service";
import { SettingsService } from "../core/settings.service";
import { useSection } from "../core/section";
import { Payout, Summary } from "../models";
import { ChangePasswordComponent } from "../ui/change-password.component";
import { PageHeaderComponent } from "../ui/page-header.component";
import { StatCardComponent } from "../ui/stat-card.component";
import { StatusBadgeComponent } from "../ui/status-badge.component";
import { ReportCenterComponent } from "../ui/report-center.component";

@Component({
  selector: "app-owner",
  standalone: true,
  imports: [ChangePasswordComponent, DatePipe, DecimalPipe, CurrencyPipe, PageHeaderComponent, StatCardComponent, StatusBadgeComponent, ReportCenterComponent],
  template: `
    <div class="stack">
      <app-page-header
        eyebrow="Owner"
        [title]="section() === 'overview' ? 'Owner dashboard' : label()"
        subtitle="Follow production, vault holdings and cash received, and confirm each payout."
      />

      @if (section() === "password") { <app-change-password /> }

      @if (section() === "overview") {
      <section class="cards">
        <app-stat-card label="Waiting to be crushed" [value]="summary()?.wheelbarrowsAvailable" unit="wheelbarrows" icon="stone" tone="stone" />
        <app-stat-card label="Gold produced by the mill" [value]="summary()?.goldProduced | number: '1.3-3'" unit="g" icon="gold" />
        <app-stat-card label="Gold in vault" [value]="summary()?.goldInVault | number: '1.3-3'" unit="g" icon="vault" />
        <app-stat-card label="Total cash received" [value]="summary()?.cashPaid | currency: settings.currency()" icon="cash" tone="ok" />
        @if (pendingCount() > 0) {
          <app-stat-card label="Awaiting your confirmation" [value]="pendingCount()" unit="payouts" icon="alert" tone="warn" />
        }
      </section>
      }

      @switch (section()) {
        @case ("reports") { <app-report-center /> }
        @case ("report-general") { <app-report-center [only]="'general'" /> }
        @case ("report-stone") { <app-report-center [only]="'stone'" /> }
        @case ("report-produced") { <app-report-center [only]="'produced'" /> }
        @case ("report-sold") { <app-report-center [only]="'sold'" /> }
      }

      @if (message() && section() === "payouts") {
        <p class="alert" [class.alert-ok]="!isError()" [class.alert-error]="isError()" role="status">{{ message() }}</p>
      }

      @if (section() === "payouts") {
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Cash payouts</h3>
            <p>Confirm the grams you actually received. Differences are flagged to the manager as a dispute.</p>
          </div>
          <span class="count-pill">{{ payouts().length }} payouts</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Managed by</th>
                <th scope="col" class="num">Grams sold</th>
                <th scope="col" class="num">Price / g</th>
                <th scope="col" class="num">Cash</th>
                <th scope="col">Confirm grams received</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payouts(); track p.id) {
                <tr>
                  <td class="nowrap">{{ p.paidAt | date: "d MMM y" }}<span class="sub">{{ p.paidAt | date: "shortTime" }}</span></td>
                  <td>{{ p.manager.fullName }}</td>
                  <td class="num">{{ p.gramsSold | number: "1.3-3" }}</td>
                  <td class="num">{{ p.pricePerGram | currency: p.currency }}</td>
                  <td class="num strong">{{ p.totalCash | currency: p.currency }}</td>
                  <td>
                    @if (p.status === "PENDING") {
                      <div class="confirm-cell">
                        <input #grams type="number" step="0.001" [value]="p.gramsSold" aria-label="Grams received" />
                        <input #note placeholder="Note if different" aria-label="Note if different" />
                        <button class="btn-sm" (click)="confirm(p.id, grams.value, note.value)">Confirm</button>
                      </div>
                    } @else if (p.status === "CONFIRMED") {
                      <span class="strong">{{ p.gramsConfirmed | number: "1.3-3" }} g</span>
                    } @else {
                      <span class="warn">Disputed</span>
                    }
                  </td>
                  <td>
                    <app-status-badge [status]="p.status" />
                    @if (p.status === "DISPUTED" && p.disputeNote) {
                      <span class="sub warn">{{ p.disputeNote }}</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty">No payouts yet</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      }
    </div>
  `,
})
export class OwnerComponent implements OnInit {
  settings = inject(SettingsService);
  private api = inject(ApiService);
  private nav = useSection("OWNER");
  section = this.nav.section;
  label = this.nav.label;

  summary = signal<Summary | null>(null);
  payouts = signal<Payout[]>([]);
  message = signal("");
  isError = signal(false);

  ngOnInit() {
    this.load();
  }

  pendingCount(): number {
    return this.payouts().filter((p) => p.status === "PENDING").length;
  }

  load() {
    this.api.get<Summary>("/summary").subscribe((s) => this.summary.set(s));
    this.api.get<Payout[]>("/payouts").subscribe((p) => this.payouts.set(p));
  }

  confirm(id: string, grams: string, note: string) {
    this.isError.set(false);
    this.api
      .patch<Payout>(`/payouts/${id}/confirm`, {
        gramsConfirmed: Number(grams),
        disputeNote: note || undefined,
      })
      .subscribe({
        next: (p) => {
          this.message.set(
            p.status === "CONFIRMED"
              ? "Gold confirmed and matched"
              : "Dispute recorded. The manager has been notified",
          );
          this.isError.set(p.status !== "CONFIRMED");
          this.load();
        },
        error: (err) => {
          this.message.set(err.error?.message ?? "Could not confirm");
          this.isError.set(true);
        },
      });
  }
}
