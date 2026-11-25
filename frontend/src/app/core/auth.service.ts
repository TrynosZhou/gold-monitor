import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { tap } from "rxjs";
import { environment } from "../../environments/environment";
import { AuthUser, HOME_ROUTE } from "../models";

@Injectable({ providedIn: "root" })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<AuthUser | null>(
    JSON.parse(localStorage.getItem("gm_user") ?? "null"),
  );

  login(username: string, password: string) {
    return this.http
      .post<{ token: string; user: AuthUser }>(`${environment.apiUrl}/auth/login`, {
        username,
        password,
      })
      .pipe(
        tap(({ token, user }) => {
          localStorage.setItem("gm_token", token);
          localStorage.setItem("gm_user", JSON.stringify(user));
          this.user.set(user);
        }),
      );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ message?: string }>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  token(): string | null {
    return localStorage.getItem("gm_token");
  }

  homeRoute(): string {
    const u = this.user();
    return (u && HOME_ROUTE[u.role]) || "/login";
  }

  logout() {
    localStorage.removeItem("gm_token");
    localStorage.removeItem("gm_user");
    this.user.set(null);
    this.router.navigateByUrl("/login");
  }
}
