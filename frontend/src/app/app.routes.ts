import { Routes } from "@angular/router";
import { roleGuard } from "./core/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./pages/login.component").then((m) => m.LoginComponent),
  },
  { path: "fetcher", pathMatch: "full", redirectTo: "fetcher/overview" },
  {
    path: "fetcher/:section",
    canActivate: [roleGuard("FETCHER")],
    loadComponent: () => import("./pages/fetcher.component").then((m) => m.FetcherComponent),
  },
  { path: "miller", pathMatch: "full", redirectTo: "miller/overview" },
  {
    path: "miller/:section",
    canActivate: [roleGuard("MILLER")],
    loadComponent: () => import("./pages/miller.component").then((m) => m.MillerComponent),
  },
  { path: "manager", pathMatch: "full", redirectTo: "manager/overview" },
  {
    path: "manager/:section",
    canActivate: [roleGuard("MANAGER")],
    loadComponent: () => import("./pages/manager.component").then((m) => m.ManagerComponent),
  },
  { path: "owner", pathMatch: "full", redirectTo: "owner/overview" },
  {
    path: "owner/:section",
    canActivate: [roleGuard("OWNER")],
    loadComponent: () => import("./pages/owner.component").then((m) => m.OwnerComponent),
  },
  { path: "admin", pathMatch: "full", redirectTo: "admin/overview" },
  {
    path: "admin/:section",
    canActivate: [roleGuard("ADMIN")],
    loadComponent: () => import("./pages/admin.component").then((m) => m.AdminComponent),
  },
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "**", redirectTo: "login" },
];
