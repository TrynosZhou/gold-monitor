import { computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";
import { Role } from "../models";
import { sectionIds, sectionLabel } from "./nav";

/**
 * Reads the `:section` route parameter for a dashboard (falls back to "overview").
 * Call from a component field initialiser.
 */
export function useSection(role: Role) {
  const route = inject(ActivatedRoute);
  const raw = toSignal(route.paramMap.pipe(map((p) => p.get("section") ?? "overview")), {
    initialValue: route.snapshot.paramMap.get("section") ?? "overview",
  });
  const valid = sectionIds(role);
  const section = computed(() => (valid.includes(raw()) ? raw() : "overview"));
  const label = computed(() => sectionLabel(role, section()));
  return { section, label };
}
