// src/app/features/ticket-counters/services/ticket-counter.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
// Adjusted path to common.ts based on your provided structure
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto } from '../models/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TicketCounterService {
  private apiUrl = `${environment.apiUrl}/TicketCounters`; // Adjust your API base URL

  constructor(private http: HttpClient) { }

  getAllTicketCounters(): Observable<TicketCounterDto[]> {
    return this.http.get<TicketCounterDto[]>(this.apiUrl);
  }

  // ID type is string based on your DTOs
  getTicketCounterById(id: string): Observable<TicketCounterDto> {
    return this.http.get<TicketCounterDto>(`${this.apiUrl}/${id}`);
  }

  // locationId type is string based on your DTOs
  getTicketCountersByLocation(locationId: string): Observable<TicketCounterDto[]> {
    return this.http.get<TicketCounterDto[]>(`${this.apiUrl}/byLocation/${locationId}`);
  }

  createTicketCounter(createDto: CreateTicketCounterDto): Observable<TicketCounterDto> {
    return this.http.post<TicketCounterDto>(this.apiUrl, createDto);
  }

  // ID type is string based on your DTOs
  updateTicketCounter(id: number, updateDto: UpdateTicketCounterDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, updateDto);
  }

  // ID type is string based on your DTOs
  deleteTicketCounter(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}