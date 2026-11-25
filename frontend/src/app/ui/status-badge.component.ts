import { Component, Input } from "@angular/core";
import { Payout } from "../models";

@Component({
  selector: "app-status-badge",
  standalone: true,
  template: `
    @switch (status) {
      @case ("CONFIRMED") { <span class="badge badge-ok">Confirmed</span> }
      @case ("DISPUTED") { <span class="badge badge-danger">Disputed</span> }
      @default { <span class="badge badge-warn">Awaiting owner</span> }
    }
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status: Payout["status"] = "PENDING";
}
