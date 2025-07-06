// src/app/services/ticket-counter.service.ts
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto } from '../models/common';

@Injectable({
  providedIn: 'root'
})
export class TicketCounterService {
  private readonly endpoint = '/TicketCounters'; // Matches your backend controller route

  constructor(private apiService: ApiService) { }

  getAllTicketCounters(): Observable<TicketCounterDto[]> {
    return this.apiService.get<TicketCounterDto[]>(this.endpoint);
  }

  getTicketCounterById(id: string): Observable<TicketCounterDto> {
    return this.apiService.get<TicketCounterDto>(`${this.endpoint}/${id}`);
  }

  getTicketCountersByLocation(locationId: string): Observable<TicketCounterDto[]> {
    // Assuming your backend has an endpoint like /api/TicketCounters/ByLocation/{locationId}
    return this.apiService.get<TicketCounterDto[]>(`${this.endpoint}/ByLocation/${locationId}`);
  }

  createTicketCounter(data: CreateTicketCounterDto): Observable<TicketCounterDto> {
    return this.apiService.post<TicketCounterDto>(this.endpoint, data);
  }

  updateTicketCounter(id: string, data: UpdateTicketCounterDto): Observable<void> {
    return this.apiService.put<void>(`${this.endpoint}/${id}`, data);
  }

  deleteTicketCounter(id: string): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }
}