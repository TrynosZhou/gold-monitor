import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ApiService } from "../core/api.service";
import { useSection } from "../core/section";
import { CrushingRun, Summary } from "../models";
import { ChangePasswordComponent } from "../ui/change-password.component";
import { PageHeaderComponent } from "../ui/page-header.component";
import { StatCardComponent } from "../ui/stat-card.component";

@Component({
  selector: "app-miller",
  standalone: true,
  imports: [ChangePasswordComponent, ReactiveFormsModule, DatePipe, DecimalPipe, PageHeaderComponent, StatCardComponent],
  template: `
    <div class="stack">
      <app-page-header
        eyebrow="Miller"
        [title]="section() === 'overview' ? 'Mill crushing' : label()"
        subtitle="Record each crushing run and the gold recovered from it."
      />

      @if (section() === "password") { <app-change-password /> }

      @if (section() === "overview") {
      <section class="cards">
        <app-stat-card label="Waiting to be crushed" [value]="summary()?.wheelbarrowsAvailable" unit="wheelbarrows" icon="stone" tone="stone" />
        <app-stat-card label="Gold produced (all time)" [value]="summary()?.goldProduced | number: '1.3-3'" unit="g" icon="gold" />
        <app-stat-card label="Runs logged" [value]="runs().length" icon="list" tone="stone" />
        <app-stat-card label="Average yield" [value]="avgYield() | number: '1.3-3'" unit="g / wheelbarrow" icon="chart" tone="ok" />
      </section>
      }

      @if (section() === "record") {
        <form class="panel" [formGroup]="form" (ngSubmit)="submit()">
          <div class="panel-head">
            <div>
              <h3>Record a crushing run</h3>
              <p>Log what was crushed and the gold you recovered.</p>
            </div>
          </div>
          <div class="panel-body">
            <label>
              Wheelbarrows crushed
              <span class="hint">Maximum {{ summary()?.wheelbarrowsAvailable ?? 0 }} available</span>
              <input type="number" min="1" formControlName="wheelbarrowsCrushed" />
            </label>
            <label>
              Gold recovered (grams)
              <input type="number" step="0.001" min="0" formControlName="goldGrams" />
            </label>
            <label>
              Notes
              <textarea formControlName="notes" rows="3" placeholder="Optional"></textarea>
            </label>
            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? "Saving…" : "Record crushing run" }}
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
              <h3>Crushing history</h3>
              <p>Every run recorded at the mill.</p>
            </div>
            <span class="count-pill">{{ runs().length }} runs</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Miller</th>
                  <th scope="col" class="num">Wheelbarrows</th>
                  <th scope="col" class="num">Gold (g)</th>
                  <th scope="col">Notes</th>
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
          </div>
        </section>
      }
    </div>
  `,
})
export class MillerComponent implements OnInit {
  private api = inject(ApiService);
  private nav = useSection("MILLER");
  section = this.nav.section;
  label = this.nav.label;
  private fb = inject(FormBuilder);

  summary = signal<Summary | null>(null);
  runs = signal<CrushingRun[]>([]);
  saving = signal(false);
  message = signal("");
  isError = signal(false);

  form = this.fb.nonNullable.group({
    wheelbarrowsCrushed: [1, [Validators.required, Validators.min(1)]],
    goldGrams: [0, [Validators.required, Validators.min(0)]],
    notes: [""],
  });

  ngOnInit() {
    this.load();
  }

  /** Average grams of gold recovered per wheelbarrow, across the loaded history. */
  avgYield(): number | null {
    const barrows = this.runs().reduce((s, r) => s + (r.wheelbarrowsCrushed || 0), 0);
    const grams = this.runs().reduce((s, r) => s + (r.goldGrams || 0), 0);
    return barrows > 0 ? grams / barrows : null;
  }

  load() {
    this.api.get<Summary>("/summary").subscribe((s) => this.summary.set(s));
    this.api.get<CrushingRun[]>("/crushing").subscribe((r) => this.runs.set(r));
  }

  submit() {
    this.saving.set(true);
    this.message.set("");
    this.isError.set(false);
    this.api.post("/crushing", this.form.getRawValue()).subscribe({
      next: () => {
        this.message.set("Crushing run recorded");
        this.form.reset({ wheelbarrowsCrushed: 1, goldGrams: 0, notes: "" });
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.message.set(err.error?.message ?? "Could not save crushing run");
        this.isError.set(true);
        this.saving.set(false);
      },
    });
  }
}
