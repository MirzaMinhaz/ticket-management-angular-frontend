// src/app/models/common.ts

export interface LocationDto {
  id: number;
  locationCode: string;
  name: string;
  type: string;
  address: string;
  createdAt: string;
  lastModifiedAt?: string;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface CreateLocationDto {
  name: string;
  type: string;
  address: string;
}

export interface UpdateLocationDto {
  name: string;
  type: string;
  address: string;
}

export interface Vehicle {
  id: number;
  type: string;
  model: string;
  licensePlate: string;
  capacity: number;
  vehicleCode: string;
  acType: string | null; // ← was: string
  busCategory: string | null; // ← was: string
  deckLevel: string | null; // ← was: string
  operatorId?: number;
  operatorCode?: string;
  operatorName?: string;
  createdAt?: string;
  lastModifiedAt?: string;
  isActive: boolean;
}

export interface CreateVehicleDto {
  operatorCode: string;
  type: string;
  model: string;
  licensePlate: string;
  capacity: number;
  acType: string | null; // ← was: string
  busCategory: string | null; // ← was: string
  deckLevel: string | null;
}

export interface UpdateVehicleDto {
  operatorCode: string;
  type: string;
  model: string;
  licensePlate: string;
  capacity: number;
  isActive: boolean;
  acType: string | null; // ← was: string
  busCategory: string | null; // ← was: string
  deckLevel: string | null;
}

// ── Ticket ────────────────────────────────────────────────────────────────────

export interface TicketDto {
  id: number;
  tripId: number;
  ticketCode: string;
  passengerName: string;
  passengerContact: string;
  seatNumber?: string | null; // optional — seat may not be assigned yet
  seatCode?: string | null;
  farePaid: number;
  bookingDateTime: string;
  bookingCounterId: number;
  departureCounterId: number;
  arrivalCounterId: number;
  status: string; // 'Booked' | 'Cancelled'
  createdAt?: string;
  createdBy?: string; // optional — set by backend
  lastModifiedAt?: string | null;
  lastModifiedBy?: string | null;
}

export interface CreateTicketDto {
  tripId: number;
  passengerName: string;
  passengerContact: string;
  seatNumber?: string | null;
  seatCode?: string | null;
  farePaid: number;
  bookingDateTime: string;
  bookingCounterId: number;
  departureCounterId: number;
  arrivalCounterId: number;
}

export interface UpdateTicketDto {
  id: number;
  tripId: number;
  passengerName: string;
  passengerContact: string;
  seatNumber?: string | null;
  seatCode?: string | null;
  farePaid: number;
  bookingDateTime: string;
  bookingCounterId: number;
  departureCounterId: number;
  arrivalCounterId: number;
}

export interface CancelTicketDto {
  id: number;
  reason: string;
}

// ── Trip ──────────────────────────────────────────────────────────────────────

// export interface TripDto {
//   id: number;
//   scheduleId: number;
//   tripDate: string;
//   status: string;          // 'Open' | 'FullyBooked' | 'Cancelled'
//   availableSeats: number;
// }

export interface TripDto {
  id: number;
  scheduleId: number; // ✅ this is what we need
  tripDate: string;
  status: string;
  availableSeats: number;
}

export interface CreateTripDto {
  scheduleId: number;
  tripDate: string; // "YYYY-MM-DD"
}

// ── Counter ───────────────────────────────────────────────────────────────────

export interface TicketCounterDto {
  id: number;
  locationCode: string;
  counterName: string;
  counterCode?: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
  isActive: boolean;
  location?: LocationDto;
  createdAt: string;
  lastModifiedAt?: string;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface CreateTicketCounterDto {
  locationCode: string;
  counterName: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
}

export interface UpdateTicketCounterDto {
  locationCode: string;
  counterName: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
}

// ── Operator ──────────────────────────────────────────────────────────────────

export interface OperatorDto {
  id: number;
  name: string;
  type: string;
  operatorCode: string;
  createdAt: string;
  lastModifiedAt?: string;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface CreateOperatorDto {
  name: string;
  type: string;
}

export interface UpdateOperatorDto {
  name: string;
  type: string;
}

// ── Seat ──────────────────────────────────────────────────────────────────────

export type SeatStatus = 'available' | 'selected' | 'reserved' | 'locked';

export interface SeatDto {
  id: number;
  seatNumber: string;
  seatCode: string;
  isBooked: boolean;
  status: SeatStatus;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export interface RouteDto {
  id: number;
  departureLocationCode: string;
  destinationLocationCode: string;
  routeName: string;
  estimatedDurationHours: number;
}

export interface CreateRouteDto {
  departureLocationCode: string;
  destinationLocationCode: string;
  routeName: string;
  estimatedDurationHours: number;
}

export interface UpdateRouteDto {
  departureLocationCode: string;
  destinationLocationCode: string;
  routeName: string;
  estimatedDurationHours: number;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface ScheduleDto {
  id: number;
  routeId: number;
  vehicleId: number;
  departureDateTime: string;
  arrivalDateTime: string;
  baseFare: number;
  status: string;
  scheduleCode: string;
  createdAt: string;
  createdBy: string;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
  routeName?: string;
  vehicleName?: string;
}

export interface CreateScheduleDto {
  routeId: number;
  vehicleId: number;
  departureDateTime: string;
  arrivalDateTime: string;
  baseFare: number;
  status: string;
}

export interface UpdateScheduleDto {
  routeId: number;
  vehicleId: number;
  departureDateTime: string;
  arrivalDateTime: string;
  baseFare: number;
  status: string;
}


// ── User ──────────────────────────────────────────────────────────────────────

export interface UserProfileDto {
  id: number;
  username: string;
  email: string;
  role: string;
  userCode: string;
  createdAt: string;
  lastModifiedAt?: string;
}
