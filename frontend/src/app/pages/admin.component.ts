import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CurrencyPipe, DatePipe, DecimalPipe } from "@angular/common";
import { ApiService } from "../core/api.service";
import { SettingsService } from "../core/settings.service";
import { useSection } from "../core/section";
import { CrushingRun, Delivery, GoldReceipt, Payout, Summary } from "../models";
import { ChangePasswordComponent } from "../ui/change-password.component";
import { PageHeaderComponent } from "../ui/page-header.component";
import { ReconciliationComponent } from "../ui/reconciliation.component";
import { StatCardComponent } from "../ui/stat-card.component";
import { StatusBadgeComponent } from "../ui/status-badge.component";
import { ReportCenterComponent } from "../ui/report-center.component";
import { SettingsFormComponent } from "../ui/settings-form.component";

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [ChangePasswordComponent, SettingsFormComponent,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    ReconciliationComponent,
    ReportCenterComponent,
  ],
  template: `
    <div class="stack">
      <app-page-header
        eyebrow="Administrator"
        [title]="section() === 'overview' ? 'Administrator overview' : label()"
        subtitle="Read-only view of every stage. Admins cannot record or change transactions; company settings are the only thing they change."
      >
        <button class="btn-ghost btn-sm" (click)="load()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
          </svg>
          Refresh
        </button>
      </app-page-header>

      @if (section() === "password") { <app-change-password /> }

      @if (section() === "settings") { <app-settings-form /> }

      @if (section() === "overview") {
      <section class="cards">
        <app-stat-card label="Waiting to be crushed" [value]="summary()?.wheelbarrowsAvailable" unit="wheelbarrows" icon="stone" tone="stone" />
        <app-stat-card label="Gold produced" [value]="summary()?.goldProduced | number: '1.3-3'" unit="g" icon="gold" />
        <app-stat-card label="Gold in vault" [value]="summary()?.goldInVault | number: '1.3-3'" unit="g" icon="vault" />
        <app-stat-card label="Total cash paid" [value]="summary()?.cashPaid | currency: settings.currency()" icon="cash" tone="ok" />
        @if (disputedCount() > 0) {
          <app-stat-card label="Disputed payouts" [value]="disputedCount()" icon="alert" tone="warn" hint="Needs attention" />
        }
      </section>
      }

      @if (section() === "overview" || section() === "reconciliation") {
        <app-reconciliation [summary]="summary()" />
      }

      @switch (section()) {
        @case ("reports") { <app-report-center /> }
        @case ("report-general") { <app-report-center [only]="'general'" /> }
        @case ("report-stone") { <app-report-center [only]="'stone'" /> }
        @case ("report-produced") { <app-report-center [only]="'produced'" /> }
        @case ("report-sold") { <app-report-center [only]="'sold'" /> }
      }

      @if (isRecords()) {
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>{{ label() }}</h3>
            <p>Read-only record of everything captured at this stage.</p>
          </div>
          <span class="count-pill">{{ recordCount() }} records</span>
        </div>

        <div class="table-wrap" role="tabpanel">
          @switch (section()) {
            @case ("deliveries") {
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th><th scope="col">Fetcher</th><th scope="col" class="num">Wheelbarrows</th>
                    <th scope="col">Location</th><th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of deliveries(); track d.id) {
                    <tr>
                      <td class="nowrap">{{ d.deliveredAt | date: "d MMM y" }}<span class="sub">{{ d.deliveredAt | date: "shortTime" }}</span></td>
                      <td>{{ d.fetcher.fullName }}</td>
                      <td class="num strong">{{ d.wheelbarrowCount }}</td>
                      <td>{{ d.pitLocation || "—" }}</td>
                      <td class="muted">{{ d.notes || "—" }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">No deliveries yet</td></tr>
                  }
                </tbody>
              </table>
            }
            @case ("crushing") {
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th><th scope="col">Miller</th><th scope="col" class="num">Wheelbarrows</th>
                    <th scope="col" class="num">Gold (g)</th><th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of runs(); track r.id) {
                    <tr>
                      <td class="nowrap">{{ r.crushedAt | date: "d MMM y" }}<span class="sub">{{ r.crushedAt | date: "shortTime" }}</span></td>
                      <td>{{ r.miller.fullName }}</td>
                      <td class="num">{{ r.wheelbarrowsCrushed }}</td>
                      <td class="num strong">{{ r.goldGrams | number: "1.3-3" }}</td>
                      <td class="muted">{{ r.notes || "—" }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">No crushing runs yet</td></tr>
                  }
                </tbody>
              </table>
            }
            @case ("receipts") {
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th><th scope="col">Manager</th>
                    <th scope="col" class="num">Grams received</th><th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of receipts(); track g.id) {
                    <tr>
                      <td class="nowrap">{{ g.receivedAt | date: "d MMM y" }}<span class="sub">{{ g.receivedAt | date: "shortTime" }}</span></td>
                      <td>{{ g.manager.fullName }}</td>
                      <td class="num strong">{{ g.grams | number: "1.3-3" }}</td>
                      <td class="muted">{{ g.notes || "—" }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="empty">No gold receipts yet</td></tr>
                  }
                </tbody>
              </table>
            }
            @case ("payouts") {
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th><th scope="col">Manager</th><th scope="col">Owner</th>
                    <th scope="col" class="num">Grams sold</th><th scope="col" class="num">Price / g</th>
                    <th scope="col" class="num">Cash</th><th scope="col">Owner status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of payouts(); track p.id) {
                    <tr>
                      <td class="nowrap">{{ p.paidAt | date: "d MMM y" }}<span class="sub">{{ p.paidAt | date: "shortTime" }}</span></td>
                      <td>{{ p.manager.fullName }}</td>
                      <td>{{ p.owner.fullName }}</td>
                      <td class="num">{{ p.gramsSold | number: "1.3-3" }}</td>
                      <td class="num">{{ p.pricePerGram | currency: p.currency }}</td>
                      <td class="num strong">{{ p.totalCash | currency: p.currency }}</td>
                      <td>
                        <app-status-badge [status]="p.status" />
                        @if (p.status === "CONFIRMED") {
                          <span class="sub">{{ p.gramsConfirmed | number: "1.3-3" }} g confirmed</span>
                        } @else if (p.status === "DISPUTED") {
                          <span class="sub warn">{{ p.disputeNote }}</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7" class="empty">No payouts yet</td></tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>
      </section>
      }
    </div>
  `,
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  settings = inject(SettingsService);
  private nav = useSection("ADMIN");
  section = this.nav.section;
  label = this.nav.label;

  summary = signal<Summary | null>(null);
  deliveries = signal<Delivery[]>([]);
  runs = signal<CrushingRun[]>([]);
  receipts = signal<GoldReceipt[]>([]);
  payouts = signal<Payout[]>([]);
  isRecords = computed(() => ["deliveries", "crushing", "receipts", "payouts"].includes(this.section()));
  recordCount = computed(() => {
    switch (this.section()) {
      case "deliveries": return this.deliveries().length;
      case "crushing": return this.runs().length;
      case "receipts": return this.receipts().length;
      default: return this.payouts().length;
    }
  });

  ngOnInit() {
    this.load();
  }

  disputedCount(): number {
    return this.payouts().filter((p) => p.status === "DISPUTED").length;
  }

  load() {
    this.api.get<Summary>("/summary").subscribe((s) => this.summary.set(s));
    this.api.get<Delivery[]>("/deliveries").subscribe((r) => this.deliveries.set(r));
    this.api.get<CrushingRun[]>("/crushing").subscribe((r) => this.runs.set(r));
    this.api.get<GoldReceipt[]>("/gold-receipts").subscribe((r) => this.receipts.set(r));
    this.api.get<Payout[]>("/payouts").subscribe((r) => this.payouts.set(r));
  }
}
