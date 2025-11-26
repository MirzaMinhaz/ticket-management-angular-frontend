// src/app/services/seat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SeatDto } from '../models/common';

@Injectable({ providedIn: 'root' })
export class SeatService {
  private apiUrl = 'http://localhost:5000/api/seat'; // adjust to your backend

  constructor(private http: HttpClient) {}

  getSeatsBySchedule(scheduleId: number): Observable<SeatDto[]> {
    return this.http.get<SeatDto[]>(`${this.apiUrl}/schedule/${scheduleId}`);
  }

  bookSeat(seatId: number, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/book/${seatId}?userId=${userId}`, {});
  }

  cancelSeat(seatId: number, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel/${seatId}?userId=${userId}`, {});
  }
}
