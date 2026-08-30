// services/ticket.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  TicketDto,
  CreateTicketDto,
  UpdateTicketDto,
  CancelTicketDto,
} from '../models/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly base = `${environment.apiUrl}/Ticket`;

  constructor(private http: HttpClient) {}

  getTickets(): Observable<TicketDto[]> {
    return this.http.get<TicketDto[]>(this.base);
  }

  getTicketById(id: number): Observable<TicketDto> {
    return this.http.get<TicketDto>(`${this.base}/${id}`);
  }

  createTicket(dto: CreateTicketDto): Observable<TicketDto> {
    return this.http.post<TicketDto>(this.base, dto);
  }

  updateTicket(dto: UpdateTicketDto): Observable<TicketDto> {
    return this.http.put<TicketDto>(`${this.base}/${dto.id}`, dto);
  }

  deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  cancelTicket(dto: CancelTicketDto): Observable<TicketDto> {
    return this.http.patch<TicketDto>(`${this.base}/${dto.id}/cancel`, dto);
  }
  getMyTickets(): Observable<TicketDto[]> {
    return this.http.get<TicketDto[]>(`${this.base}/my`);
  }
}
