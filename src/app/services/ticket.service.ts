// src/app/services/ticket.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ticket, TicketCreateRequest, TicketUpdateRequest } from '../models/common';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private baseUrl = '/api/tickets';

  constructor(private http: HttpClient) {}

  // List with simple optional filters
  getTickets(filter?: { status?: string; scheduleId?: number; passengerName?: string }): Observable<Ticket[]> {
    let params = new HttpParams();
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.scheduleId) params = params.set('scheduleId', filter.scheduleId.toString());
    if (filter?.passengerName) params = params.set('passengerName', filter.passengerName);
    return this.http.get<Ticket[]>(this.baseUrl, { params });
  }

  getTicket(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  createTicket(payload: TicketCreateRequest): Observable<Ticket> {
    return this.http.post<Ticket>(this.baseUrl, payload);
  }

  updateTicket(payload: TicketUpdateRequest): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.baseUrl}/${payload.id}`, payload);
  }

  deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
