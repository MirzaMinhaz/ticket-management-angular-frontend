// src/app/services/seat-lock.service.ts
// Thin adapter — matches the API TrainTicketComponent expects.

import { Injectable } from '@angular/core';
import {
  SeatHubService,
  SeatLockedEvent,
  SeatReleasedEvent,
  LockFailedEvent,
  LockedSeatsSnapshotEvent,
} from './seat-hub.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SeatLockService {

  readonly seatLocked$:          Observable<SeatLockedEvent>;
  readonly seatReleased$:        Observable<SeatReleasedEvent>;
  readonly lockFailed$:          Observable<LockFailedEvent>;
  readonly lockedSeatsSnapshot$: Observable<LockedSeatsSnapshotEvent>;

  constructor(private hub: SeatHubService) {
    this.seatLocked$          = hub.seatLocked$;
    this.seatReleased$        = hub.seatReleased$;
    this.lockFailed$          = hub.lockFailed$;
    this.lockedSeatsSnapshot$ = hub.lockedSeatsSnapshot$;
  }

  /** Alias for SeatHubService.connect() — now re-throws on failure */
  startConnection(hubUrl: string): Promise<void> {
    return this.hub.connect(hubUrl);
  }

  /** Delegates to the proper getter — no `as any` */
  get isConnected(): boolean {
    return this.hub.isConnected;
  }

  get connectionId(): string {
    return this.hub.connectionId;
  }

  joinTrip(tripId: number):                               Promise<void> { return this.hub.joinTrip(tripId); }
  leaveTrip(tripId: number):                              Promise<void> { return this.hub.leaveTrip(tripId); }
  lockSeat(tripId: number, seatNumber: string):           Promise<void> { return this.hub.lockSeat(tripId, seatNumber); }
  releaseSeat(tripId: number, seatNumber: string):        Promise<void> { return this.hub.releaseSeat(tripId, seatNumber); }
  getLockedSeats(tripId: number):                         Promise<void> { return this.hub.getLockedSeats(tripId); }
}