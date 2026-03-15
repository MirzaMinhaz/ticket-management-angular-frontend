import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ScheduleDto, CreateScheduleDto, UpdateScheduleDto } from '../models/common';

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private apiUrl = 'https://localhost:7139/api/Schedule'; // ✅ Adjust to your API base URL

  constructor(private http: HttpClient) {}

  // Get all schedules
  getAllSchedules(): Observable<ScheduleDto[]> {
    return this.http.get<ScheduleDto[]>(this.apiUrl);
  }

  // Get schedule by ID
  getScheduleById(id: number): Observable<ScheduleDto> {
    return this.http.get<ScheduleDto>(`${this.apiUrl}/${id}`);
  }

  // Create new schedule
  createSchedule(createDto: CreateScheduleDto): Observable<ScheduleDto> {
    // Some APIs use POST /Schedules, others use /Schedules/create
    return this.http.post<ScheduleDto>(this.apiUrl, createDto);
  }

  // Update existing schedule
  updateSchedule(id: number, updateDto: UpdateScheduleDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, updateDto);
  }

  // Delete schedule
  deleteSchedule(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
