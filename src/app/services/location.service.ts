import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { LocationDto, CreateLocationDto, UpdateLocationDto } from '../models/common';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly endpoint = '/Locations';

  constructor(private apiService: ApiService) { }

  getAllLocations(): Observable<LocationDto[]> {
    return this.apiService.get<LocationDto[]>(this.endpoint);
  }

  getLocationById(id: number): Observable<LocationDto> {
    return this.apiService.get<LocationDto>(`${this.endpoint}/${id}`);
  }

  createLocation(data: CreateLocationDto): Observable<LocationDto> {
    return this.apiService.post<LocationDto>(this.endpoint, data);
  }

  updateLocation(id: number, data: UpdateLocationDto): Observable<void> {
    return this.apiService.put<void>(`${this.endpoint}/${id}`, data);
  }

  deleteLocation(id: number): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  checkLocationExists(name: string, type: string): Observable<boolean> {
    const queryString = `?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    return this.apiService.get<boolean>(`${this.endpoint}/exists${queryString}`);
  }
}
