// src/app/services/seat-hub.service.ts

import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

declare global {
  interface Window {
    signalR: {
      HubConnectionBuilder: new () => IHubConnectionBuilder;
      HubConnectionState: { Connected: string; Disconnected: string; Reconnecting: string };
      LogLevel: { Information: number; Warning: number; Error: number; None: number };
    };
  }
}

interface IHubConnectionBuilder {
  withUrl(url: string, options?: unknown): IHubConnectionBuilder;
  withAutomaticReconnect(): IHubConnectionBuilder;
  configureLogging(level: number): IHubConnectionBuilder;
  build(): IHubConnection;
}

interface IHubConnection {
  state: string;
  connectionId: string | null;           // ← expose properly
  on(methodName: string, newMethod: (...args: unknown[]) => void): void;
  off(methodName: string): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke(methodName: string, ...args: unknown[]): Promise<unknown>;
}

export interface SeatLockedEvent          { tripId: number; seatNumber: string; connectionId: string; }
export interface SeatReleasedEvent        { tripId: number; seatNumber: string; }
export interface LockFailedEvent          { tripId: number; seatNumber: string; reason: string; }
export interface LockedSeat               { seatNumber: string; connectionId: string; }
export interface LockedSeatsSnapshotEvent { tripId: number; seats: LockedSeat[]; }
/** Fired when seats have been permanently booked (a ticket was saved) — as
 *  opposed to SeatLockedEvent, which is only a temporary in-progress hold. */
export interface SeatsBookedEvent         { tripId: number; seatNumbers: string[]; }

const SIGNALR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js';

@Injectable({ providedIn: 'root' })
export class SeatHubService implements OnDestroy {

  readonly seatLocked$          = new Subject<SeatLockedEvent>();
  readonly seatReleased$        = new Subject<SeatReleasedEvent>();
  readonly lockFailed$          = new Subject<LockFailedEvent>();
  readonly lockedSeatsSnapshot$ = new Subject<LockedSeatsSnapshotEvent>();
  readonly seatsBooked$         = new Subject<SeatsBookedEvent>();

  private connection: IHubConnection | null = null;
  private scriptLoaded  = false;
  private scriptLoading: Promise<void> | null = null;
  private connectPromise: Promise<void> | null = null;  // ← guard double-connect
  private currentTripId: number | null = null;
  private handlersRegistered = false;                   // ← prevent duplicate handlers

  get connectionId(): string {
    return this.connection?.connectionId ?? '';
  }

  /** Proper isConnected — no `as any` needed */
  get isConnected(): boolean {
    return this.connection?.state === 'Connected';
  }

  // ── connect ───────────────────────────────────────────────────────────────

  async connect(hubUrl: string): Promise<void> {
    // Already connected — nothing to do
    if (this.isConnected) return;

    // Already in the middle of connecting — return the same promise
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this._doConnect(hubUrl).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async _doConnect(hubUrl: string): Promise<void> {
    await this.loadScript();

    // Build a fresh connection (only once; if it already exists and is not
    // connected, stop it first to clean up)
    if (this.connection) {
      try { await this.connection.stop(); } catch { /* ignore */ }
      this.handlersRegistered = false;
    }

    this.connection = new window.signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .configureLogging(window.signalR.LogLevel.Warning)
      .build();

    if (!this.handlersRegistered) {
      this.registerHandlers();
      this.handlersRegistered = true;
    }

    // This time we DO re-throw so callers know the connection failed
    await this.connection.start();
    console.log('[SeatHub] Connected. ConnectionId:', this.connectionId);
  }

  async disconnect(): Promise<void> {
    if (this.currentTripId !== null) {
      await this.leaveTrip(this.currentTripId);
    }
    await this.connection?.stop();
    this.connection = null;
    this.handlersRegistered = false;
  }

  // ── Hub invocations ───────────────────────────────────────────────────────

  async joinTrip(tripId: number): Promise<void> {
    this.currentTripId = tripId;
    await this.invoke('JoinTrip', tripId);
  }

  async leaveTrip(tripId: number): Promise<void> {
    this.currentTripId = null;
    await this.invoke('LeaveTrip', tripId);
  }

  async lockSeat(tripId: number, seatNumber: string): Promise<void> {
    await this.invoke('LockSeat', tripId, seatNumber);
  }

  async releaseSeat(tripId: number, seatNumber: string): Promise<void> {
    await this.invoke('ReleaseSeat', tripId, seatNumber);
  }

  async getLockedSeats(tripId: number): Promise<void> {
    await this.invoke('GetLockedSeats', tripId);
  }

  /**
   * Call this the moment a ticket save/update succeeds for the given seats.
   * Tells the server to drop the temporary locks and broadcast to every
   * connected client (on this trip) that these seats are now permanently
   * booked — so they flip to "Taken" immediately, with no page refresh.
   */
  async confirmBooking(tripId: number, seatNumbers: string[]): Promise<void> {
    if (!seatNumbers.length) return;
    await this.invoke('ConfirmBooking', tripId, seatNumbers);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async invoke(method: string, ...args: unknown[]): Promise<void> {
    if (!this.isConnected) {
      console.warn(`[SeatHub] Cannot invoke ${method}: not connected (state=${this.connection?.state ?? 'null'}).`);
      return;
    }
    try {
      await this.connection!.invoke(method, ...args);
    } catch (err) {
      console.error(`[SeatHub] Invoke ${method} failed:`, err);
    }
  }

  private registerHandlers(): void {
    if (!this.connection) return;

    this.connection.on('SeatLocked', (tripId: unknown, seatNumber: unknown, connectionId: unknown) => {
      this.seatLocked$.next({
        tripId: tripId as number,
        seatNumber: seatNumber as string,
        connectionId: connectionId as string,
      });
    });

    this.connection.on('SeatReleased', (tripId: unknown, seatNumber: unknown) => {
      this.seatReleased$.next({ tripId: tripId as number, seatNumber: seatNumber as string });
    });

    this.connection.on('LockFailed', (tripId: unknown, seatNumber: unknown, reason: unknown) => {
      this.lockFailed$.next({
        tripId: tripId as number,
        seatNumber: seatNumber as string,
        reason: reason as string,
      });
    });

    this.connection.on('LockedSeatsSnapshot', (tripId: unknown, seats: unknown) => {
      this.lockedSeatsSnapshot$.next({
        tripId: tripId as number,
        seats: seats as LockedSeat[],
      });
    });

    this.connection.on('SeatsBooked', (tripId: unknown, seatNumbers: unknown) => {
      this.seatsBooked$.next({
        tripId: tripId as number,
        seatNumbers: seatNumbers as string[],
      });
    });
  }

  private loadScript(): Promise<void> {
    if (this.scriptLoaded)  return Promise.resolve();
    if (this.scriptLoading) return this.scriptLoading;

    this.scriptLoading = new Promise<void>((resolve, reject) => {
      if (window.signalR) { this.scriptLoaded = true; resolve(); return; }

      const script   = document.createElement('script');
      script.src     = SIGNALR_CDN;
      script.onload  = () => { this.scriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load SignalR from CDN.'));
      document.head.appendChild(script);
    });

    return this.scriptLoading;
  }

  ngOnDestroy(): void {
    this.connection?.stop();
  }
}