import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AppVersionInfo {
  version: string;
  source?: string;
  commit?: string;
  generatedAt?: string;
}

@Injectable({ providedIn: 'root' },)
export class VersionService {
  private readonly url = 'assets/version.json';

  constructor(private http: HttpClient) {
    debugger;
    console.log("versions service initialized");
  }

  getVersion(): Observable<string> {
    return this.http.get<AppVersionInfo>(this.url).pipe(
      map((info) => info?.version ?? 'v0.0.0'),
      catchError(() => of('v0.0.0'))
    );
  }

  getInfo(): Observable<AppVersionInfo> {
    return this.http.get<AppVersionInfo>(this.url).pipe(
      catchError(() => of({ version: 'v0.0.0' }))
    );
  }
}