// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { LocationDto, CreateLocationDto, UpdateLocationDto } from '../models/common';
// No longer need HttpParams here if ApiService.get doesn't use it directly
// import { HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly endpoint = '/Locations';

  constructor(private apiService: ApiService) { } // Inject ApiService

  getAllLocations(): Observable<LocationDto[]> {
    return this.apiService.get<LocationDto[]>(this.endpoint);
  }

  getLocationById(id: string): Observable<LocationDto> {
    return this.apiService.get<LocationDto>(`${this.endpoint}/${id}`);
  }

  createLocation(data: CreateLocationDto): Observable<LocationDto> {
    return this.apiService.post<LocationDto>(this.endpoint, data);
  }

  updateLocation(id: string, data: UpdateLocationDto): Observable<void> {
    return this.apiService.put<void>(`${this.endpoint}/${id}`, data);
  }

  deleteLocation(id: string): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  // CORRECTED: checkLocationExists to manually build URL with query parameters
  checkLocationExists(name: string, type: string): Observable<boolean> {
    // Manually construct the query string
    const queryString = `?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    return this.apiService.get<boolean>(`${this.endpoint}/exists${queryString}`); // <--- Corrected this line
  }
}