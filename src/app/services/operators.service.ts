import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  OperatorDto,
  CreateOperatorDto,
  UpdateOperatorDto,
} from '../models/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OperatorService {
  private baseUrl = `${environment.apiUrl}/operators`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<OperatorDto[]> {
    return this.http.get<OperatorDto[]>(this.baseUrl);
  }

  create(dto: CreateOperatorDto): Observable<OperatorDto> {
    return this.http.post<OperatorDto>(`${this.baseUrl}/create`, dto);
  }

  update(id: number, operator: UpdateOperatorDto): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, operator);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
