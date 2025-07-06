// src/app/services/location.service.ts
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { LocationDto, CreateLocationDto, UpdateLocationDto } from '../models/common';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly endpoint = '/Locations'; // Matches your backend controller route

  constructor(private apiService: ApiService) { }

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
}