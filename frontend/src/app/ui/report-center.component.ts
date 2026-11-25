import { Component, HostListener, Input, OnDestroy, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { REPORTS, ReportId, ReportInfo, ReportService } from "../core/report.service";

/**
 * Shared "Reports" panel: pick a period, then Preview (PDF) or Download (PDF)
 * any report. Used on the Owner and Administrator pages.
 */
@Component({
  selector: "app-report-center",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>{{ only ? "Report" : "Reports" }}</h3>
          <p>Preview a report on screen as a PDF, or download it to keep or print.</p>
        </div>
        <span class="count-pill">{{ visible.length }} {{ visible.length === 1 ? "report" : "reports" }}</span>
      </div>

      <div class="panel-body">
        <div class="report-period">
          <label>
            From
            <input type="date" [(ngModel)]="from" [max]="to || null" />
          </label>
          <label>
            To
            <input type="date" [(ngModel)]="to" [min]="from || null" />
          </label>
          <button type="button" class="btn-ghost btn-sm" (click)="clearPeriod()" [disabled]="!from && !to">Clear dates</button>
          <span class="hint report-hint">Leave the dates empty to include all records.</span>
        </div>

        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }

        <div class="report-grid">
          @for (r of visible; track r.id) {
            <article class="report-card">
              <div class="report-card-head">
                <span class="report-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" />
                  </svg>
                </span>
                <h4>{{ r.title }}</h4>
              </div>
              <p>{{ r.description }}</p>
              <div class="report-actions">
                <button type="button" (click)="preview(r)" [disabled]="busy() !== null">
                  {{ busy() === r.id + ':preview' ? "Preparing…" : "Preview PDF" }}
                </button>
                <button type="button" class="btn-ghost" (click)="download(r)" [disabled]="busy() !== null">
                  {{ busy() === r.id + ':download' ? "Preparing…" : "Download PDF" }}
                </button>
              </div>
            </article>
          }
        </div>
      </div>
    </section>

    @if (previewUrl(); as url) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" [class.is-max]="maximised()" role="dialog" aria-modal="true" [attr.aria-label]="previewTitle()" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ previewTitle() }}</h3>
            <div class="modal-actions">
              <button type="button" class="btn-sm" (click)="saveCurrent()">Download PDF</button>
              <button type="button" class="btn-ghost btn-sm" (click)="maximised.set(!maximised())">{{ maximised() ? "Restore" : "Maximise" }}</button>
              <button type="button" class="btn-ghost btn-sm" (click)="close()">Close</button>
            </div>
          </div>
          <div class="modal-body">
            <iframe class="modal-frame" [src]="url" [title]="previewTitle()"></iframe>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReportCenterComponent implements OnDestroy {
  private svc = inject(ReportService);
  private sanitizer = inject(DomSanitizer);

  /** Show only this report (used by the sidebar sub menus). */
  @Input() only: ReportId | null = null;
  reports: ReportInfo[] = REPORTS;

  get visible(): ReportInfo[] {
    return this.only ? this.reports.filter((r) => r.id === this.only) : this.reports;
  }
  from = "";
  to = "";

  busy = signal<string | null>(null);
  error = signal("");
  previewUrl = signal<SafeResourceUrl | null>(null);
  previewTitle = signal("");
  /** Previews open maximised (full screen) by default. */
  maximised = signal(true);

  private objectUrl: string | null = null;
  private current: { blob: Blob; filename: string } | null = null;

  clearPeriod() {
    this.from = "";
    this.to = "";
  }

  preview(r: ReportInfo) {
    this.run(r.id, "preview", (out) => {
      this.revoke();
      this.current = out;
      this.objectUrl = URL.createObjectURL(out.blob);
      this.previewTitle.set(r.title);
      this.maximised.set(true);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl + "#view=FitH"));
    });
  }

  download(r: ReportInfo) {
    this.run(r.id, "download", (out) => this.save(out));
  }

  saveCurrent() {
    if (this.current) this.save(this.current);
  }

  close() {
    this.previewUrl.set(null);
    this.revoke();
    this.current = null;
  }

  @HostListener("document:keydown.escape")
  onEscape() {
    if (this.previewUrl()) this.close();
  }

  ngOnDestroy() {
    this.revoke();
  }

  private run(id: ReportId, mode: "preview" | "download", done: (o: { blob: Blob; filename: string }) => void) {
    this.error.set("");
    if (this.from && this.to && this.from > this.to) {
      this.error.set("The 'From' date must be on or before the 'To' date.");
      return;
    }
    this.busy.set(`${id}:${mode}`);
    this.svc.generate(id, { from: this.from, to: this.to }).subscribe({
      next: (out) => {
        this.busy.set(null);
        done(out);
      },
      error: (err) => {
        this.busy.set(null);
        this.error.set(err?.message ?? "The report could not be created.");
      },
    });
  }

  private save(out: { blob: Blob; filename: string }) {
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private revoke() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
