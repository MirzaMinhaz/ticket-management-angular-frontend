import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private messageSource = new BehaviorSubject<string | null>(null);
  private typeSource = new BehaviorSubject<'success' | 'error' | null>(null);

  message$ = this.messageSource.asObservable();
  type$ = this.typeSource.asObservable();

  show(message: string, type: 'success' | 'error') {
    this.messageSource.next(message);
    this.typeSource.next(type);

    setTimeout(() => this.clear(), 1800);
  }

  clear() {
    this.messageSource.next(null);
    this.typeSource.next(null);
  }
}
