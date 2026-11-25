import { Component, OnInit, computed, effect, inject, signal } from "@angular/core";
import { CurrencyPipe, DatePipe, DecimalPipe } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { SettingsService } from "../core/settings.service";
import { Observable } from "rxjs";
import { ApiService } from "../core/api.service";
import { useSection } from "../core/section";
import { Payout, Summary } from "../models";
import { ChangePasswordComponent } from "../ui/change-password.component";
import { PageHeaderComponent } from "../ui/page-header.component";
import { ReconciliationComponent } from "../ui/reconciliation.component";
import { StatCardComponent } from "../ui/stat-card.component";
import { StatusBadgeComponent } from "../ui/status-badge.component";

interface OwnerOption {
  id: string;
  fullName: string;
}

@Component({
  selector: "app-manager",
  standalone: true,
  imports: [ChangePasswordComponent, 
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    ReconciliationComponent,
  ],
  template: `
    <div class="stack">
      <app-page-header
        eyebrow="Manager"
        [title]="section() === 'overview' ? 'Gold &amp; cash management' : label()"
        subtitle="Receive gold from the mill, sell it, and pay the owner in cash, with every stage reconciled."
      />

      @if (section() === "password") { <app-change-password /> }

      @if (section() === "overview") {
      <section class="cards">
        <app-stat-card label="Gold in vault" [value]="summary()?.goldInVault | number: '1.3-3'" unit="g" icon="vault" />
        <app-stat-card label="Awaiting receipt at mill" [value]="summary()?.goldAwaitingReceipt | number: '1.3-3'" unit="g" icon="clock" tone="stone" />
        <app-stat-card label="Pending owner confirmation" [value]="summary()?.goldPendingOwnerConfirmation | number: '1.3-3'" unit="g" icon="alert" tone="warn" />
        <app-stat-card label="Total cash paid to owner" [value]="summary()?.cashPaid | currency: settings.currency()" icon="cash" tone="ok" [hint]="payouts().length + ' payouts recorded'" />
      </section>

      }

      @if (section() === "overview" || section() === "reconciliation") {
        <app-reconciliation [summary]="summary()" />
      }

      @if (message() && (section() === "receive" || section() === "sell")) {
        <p class="alert" [class.alert-ok]="!isError()" [class.alert-error]="isError()" role="status">{{ message() }}</p>
      }

      @if (section() === "receive") {
        <form class="panel" [formGroup]="receiptForm" (ngSubmit)="saveReceipt()">
          <div class="panel-head">
            <div>
              <h3>Record gold received</h3>
              <p>Gold handed over by the miller.</p>
            </div>
          </div>
          <div class="panel-body">
            <label>
              Grams received
              <span class="hint">Maximum {{ summary()?.goldAwaitingReceipt | number: "1.3-3" }} g awaiting receipt</span>
              <input type="number" step="0.001" formControlName="grams" />
            </label>
            <label>
              Notes
              <input formControlName="notes" placeholder="Optional" />
            </label>
            <button type="submit" [disabled]="receiptForm.invalid || busy()">Save receipt</button>
          </div>
        </form>
      }

      @if (section() === "sell") {
        <form class="panel" [formGroup]="payoutForm" (ngSubmit)="savePayout()">
          <div class="panel-head">
            <div>
              <h3>Sell gold &amp; pay owner</h3>
              <p>Cash payout against gold taken from the vault.</p>
            </div>
          </div>
          <div class="panel-body">
            <label>
              Owner
              <select formControlName="ownerId">
                <option value="" disabled>Select owner</option>
                @for (o of owners(); track o.id) {
                  <option [value]="o.id">{{ o.fullName }}</option>
                }
              </select>
            </label>
            <div class="form-row">
              <label>
                Grams sold
                <span class="hint">Max {{ summary()?.goldInVault | number: "1.3-3" }} g in vault</span>
                <input type="number" step="0.001" formControlName="gramsSold" />
              </label>
              <label>
                Price per gram ({{ settings.currency() }})
                @if (settings.goldPricePerGram() > 0) {
                  <span class="hint">Current gold price from Settings: {{ settings.goldPricePerGram() | currency: settings.currency() }} per gram</span>
                }
                <input type="number" step="0.01" formControlName="pricePerGram" />
              </label>
            </div>
            <div class="total-line">
              <span>Total cash</span>
              <b>{{ payoutTotal() | currency: settings.currency() }}</b>
            </div>
            <button type="submit" [disabled]="payoutForm.invalid || busy()">Record payout</button>
          </div>
        </form>
      }

      @if (section() === "payouts") {
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Payouts to owner</h3>
            <p>Cash paid out and the owner's confirmation status.</p>
          </div>
          <span class="count-pill">{{ payouts().length }} payouts</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" class="num">Grams sold</th>
                <th scope="col" class="num">Price / g</th>
                <th scope="col" class="num">Total cash</th>
                <th scope="col">Owner status</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payouts(); track p.id) {
                <tr>
                  <td class="nowrap">{{ p.paidAt | date: "d MMM y" }}<span class="sub">{{ p.paidAt | date: "shortTime" }}</span></td>
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
                <tr><td colspan="5" class="empty">No payouts yet</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      }
    </div>
  `,
})
export class ManagerComponent implements OnInit {
  private api = inject(ApiService);
  private nav = useSection("MANAGER");
  section = this.nav.section;
  label = this.nav.label;
  private fb = inject(FormBuilder);

  summary = signal<Summary | null>(null);
  payouts = signal<Payout[]>([]);
  owners = signal<OwnerOption[]>([]);
  busy = signal(false);
  message = signal("");
  isError = signal(false);

  settings = inject(SettingsService);

  constructor() {
    // Pre-fill the sale price with the current gold price, until the user types their own.
    effect(() => {
      const price = this.settings.goldPricePerGram();
      const control = this.payoutForm.controls.pricePerGram;
      if (price > 0 && control.pristine) control.setValue(price);
    });
  }

  receiptForm = this.fb.nonNullable.group({
    grams: [0, [Validators.required, Validators.min(0.001)]],
    notes: [""],
  });

  payoutForm = this.fb.nonNullable.group({
    ownerId: ["", Validators.required],
    gramsSold: [0, [Validators.required, Validators.min(0.001)]],
    pricePerGram: [0, [Validators.required, Validators.min(0.01)]],
  });

  ngOnInit() {
    this.load();
    this.api.get<OwnerOption[]>("/users/owners").subscribe((o) => this.owners.set(o));
  }

  payoutTotal(): number {
    const v = this.payoutForm.getRawValue();
    return Math.round((v.gramsSold || 0) * (v.pricePerGram || 0) * 100) / 100;
  }

  load() {
    this.api.get<Summary>("/summary").subscribe((s) => this.summary.set(s));
    this.api.get<Payout[]>("/payouts").subscribe((p) => this.payouts.set(p));
  }

  saveReceipt() {
    this.run(
      this.api.post("/gold-receipts", this.receiptForm.getRawValue()),
      "Gold receipt recorded",
      () => this.receiptForm.reset({ grams: 0, notes: "" }),
    );
  }

  savePayout() {
    this.run(
      this.api.post("/payouts", this.payoutForm.getRawValue()),
      "Payout recorded",
      () => this.payoutForm.reset({ ownerId: "", gramsSold: 0, pricePerGram: this.settings.goldPricePerGram() }),
    );
  }

  private run(request: Observable<unknown>, success: string, onSuccess: () => void) {
    this.busy.set(true);
    this.message.set("");
    this.isError.set(false);
    request.subscribe({
      next: () => {
        this.message.set(success);
        onSuccess();
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.message.set(err.error?.message ?? "Request failed");
        this.isError.set(true);
        this.busy.set(false);
      },
    });
  }
}
