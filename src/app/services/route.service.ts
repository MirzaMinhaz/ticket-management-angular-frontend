// src/app/features/ticket-counters/services/ticket-counter.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
// Adjusted path to common.ts based on your provided structure
import { RouteDto, CreateRouteDto, UpdateRouteDto } from '../models/common';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private apiUrl = 'https://localhost:7139/api/Routes'; // Adjust your API base URL

  constructor(private http: HttpClient) { }

  getAllRoutes(): Observable<RouteDto[]> {
    return this.http.get<RouteDto[]>(this.apiUrl);
  }

  // ID type is string based on your DTOs
  getRoutesId(id: string): Observable<RouteDto> {
    return this.http.get<RouteDto>(`${this.apiUrl}/${id}`);
  }


  // createRoute(createDto: CreateRouteDto): Observable<RouteDto> {
  //   return this.http.post<RouteDto>(this.apiUrl, createDto);
  // }

  createRoute(createDto: CreateRouteDto): Observable<RouteDto> {
  return this.http.post<RouteDto>(`${this.apiUrl}/create`, createDto);
}


  // ID type is string based on your DTOs
  // updateRoute(id: number, updateDto: UpdateRouteDto): Observable<any> {
  //   return this.http.put(`${this.apiUrl}/${id}`, updateDto);
  // }

  updateRoute(id: number, updateDto: UpdateRouteDto) {
  return this.http.put(`${this.apiUrl}/${id}`, updateDto);
}


  // ID type is string based on your DTOs
  deleteRoute(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}