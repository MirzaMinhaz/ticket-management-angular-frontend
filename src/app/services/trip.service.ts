import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TripDto, CreateTripDto } from '../models/common';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly base = 'https://localhost:7139/api/trip';

  constructor(private http: HttpClient) {}

  getAll(): Observable<TripDto[]> {
    return this.http.get<TripDto[]>(this.base);
  }

  getById(id: number): Observable<TripDto> {
    return this.http.get<TripDto>(`${this.base}/${id}`);
  }

  findOrCreate(dto: CreateTripDto): Observable<TripDto> {
    return this.http.post<TripDto>(`${this.base}/find-or-create`, dto);
  }

  getBookedSeats(tripId: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/${tripId}/booked-seats`);
  }
}