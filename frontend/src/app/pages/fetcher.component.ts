import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ApiService } from "../core/api.service";
import { useSection } from "../core/section";
import { Delivery } from "../models";
import { ChangePasswordComponent } from "../ui/change-password.component";
import { PageHeaderComponent } from "../ui/page-header.component";
import { StatCardComponent } from "../ui/stat-card.component";

@Component({
  selector: "app-fetcher",
  standalone: true,
  imports: [ChangePasswordComponent, ReactiveFormsModule, DatePipe, PageHeaderComponent, StatCardComponent],
  template: `
    <div class="stack">
      <app-page-header
        eyebrow="Stone fetcher"
        [title]="section() === 'overview' ? 'Stone deliveries' : label()"
        subtitle="Log every load of ore you bring to the mill and review your recent deliveries."
      />

      @if (section() === "password") { <app-change-password /> }

      @if (section() === "overview") {
      <section class="cards">
        <app-stat-card label="Delivered today" [value]="deliveredToday()" unit="wheelbarrows" icon="stone" tone="stone" />
        <app-stat-card label="Total delivered" [value]="totalWheelbarrows()" unit="wheelbarrows" icon="chart" />
        <app-stat-card label="Deliveries logged" [value]="deliveries().length" icon="list" tone="stone" />
      </section>
      }

      @if (section() === "record") {
        <form class="panel" [formGroup]="form" (ngSubmit)="submit()">
          <div class="panel-head">
            <div>
              <h3>Record a delivery</h3>
              <p>Enter what you are bringing to the mill.</p>
            </div>
          </div>
          <div class="panel-body">
            <label>
              Wheelbarrows delivered
              <input type="number" min="1" formControlName="wheelbarrowCount" />
            </label>
            <label>
              Pit / location
              <input formControlName="pitLocation" placeholder="e.g. Pit 3, North face" />
            </label>
            <label>
              Notes
              <textarea formControlName="notes" rows="3" placeholder="Optional"></textarea>
            </label>
            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? "Saving…" : "Record delivery" }}
            </button>
            @if (message()) {
              <p class="alert" [class.alert-ok]="!isError()" [class.alert-error]="isError()" role="status">{{ message() }}</p>
            }
          </div>
        </form>
      }

      @if (section() === "history") {
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>My recent deliveries</h3>
              <p>Most recent first.</p>
            </div>
            <span class="count-pill">{{ deliveries().length }} records</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" class="num">Wheelbarrows</th>
                  <th scope="col">Location</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                @for (d of deliveries(); track d.id) {
                  <tr>
                    <td class="nowrap">{{ d.deliveredAt | date: "d MMM y" }}<span class="sub">{{ d.deliveredAt | date: "shortTime" }}</span></td>
                    <td class="num strong">{{ d.wheelbarrowCount }}</td>
                    <td>{{ d.pitLocation || "—" }}</td>
                    <td class="muted">{{ d.notes || "—" }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="empty">No deliveries recorded yet</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class FetcherComponent implements OnInit {
  private api = inject(ApiService);
  private nav = useSection("FETCHER");
  section = this.nav.section;
  label = this.nav.label;
  private fb = inject(FormBuilder);

  deliveries = signal<Delivery[]>([]);
  saving = signal(false);
  message = signal("");
  isError = signal(false);

  form = this.fb.nonNullable.group({
    wheelbarrowCount: [1, [Validators.required, Validators.min(1)]],
    pitLocation: [""],
    notes: [""],
  });

  ngOnInit() {
    this.load();
  }

  totalWheelbarrows(): number {
    return this.deliveries().reduce((sum, d) => sum + (d.wheelbarrowCount || 0), 0);
  }

  deliveredToday(): number {
    const today = new Date().toDateString();
    return this.deliveries()
      .filter((d) => new Date(d.deliveredAt).toDateString() === today)
      .reduce((sum, d) => sum + (d.wheelbarrowCount || 0), 0);
  }

  load() {
    this.api.get<Delivery[]>("/deliveries").subscribe((rows) => this.deliveries.set(rows));
  }

  submit() {
    this.saving.set(true);
    this.message.set("");
    this.isError.set(false);
    this.api.post("/deliveries", this.form.getRawValue()).subscribe({
      next: () => {
        this.message.set("Delivery recorded");
        this.form.reset({ wheelbarrowCount: 1, pitLocation: "", notes: "" });
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.message.set(err.error?.message ?? "Could not save delivery");
        this.isError.set(true);
        this.saving.set(false);
      },
    });
  }
}
