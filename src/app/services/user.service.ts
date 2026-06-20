import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfileDto } from '../models/common';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = 'https://localhost:7139/api/Auth';

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${this.base}/me`);
  }
}