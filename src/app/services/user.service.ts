import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfileDto } from '../models/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = `${environment.apiUrl}/Auth`;

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${this.base}/me`);
  }
}