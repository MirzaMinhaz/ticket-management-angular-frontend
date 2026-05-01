import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TicketDto, CreateTicketDto, UpdateTicketDto } from '../models/common';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private baseUrl = 'https://localhost:7139/api/Ticket';

  constructor(private http: HttpClient) {}

  getTickets(): Observable<TicketDto[]> {
    return this.http.get<TicketDto[]>(this.baseUrl);
  }

  getTicket(id: number): Observable<TicketDto> {
    return this.http.get<TicketDto>(`${this.baseUrl}/${id}`);
  }

  createTicket(payload: CreateTicketDto): Observable<TicketDto> {
    return this.http.post<TicketDto>(this.baseUrl, payload);
  }

  updateTicket(payload: UpdateTicketDto): Observable<TicketDto> {
    return this.http.put<TicketDto>(`${this.baseUrl}/${payload.id}`, payload);
  }

  deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}