import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class OperatorService {
  private baseUrl = '/api/operators';

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<any[]>(this.baseUrl);
  }

  create(operator: any) {
    return this.http.post(this.baseUrl, operator);
  }

  update(id: number, operator: any) {
    return this.http.put(`${this.baseUrl}/${id}`, operator);
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
