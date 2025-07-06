// src/app/models/common.ts

export interface LocationDto {
  locationId: string;
  name: string;
  type: string;
  address: string;
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

export interface TicketCounterDto {
  ticketCounterId: string;
  locationId: string;
  counterName: string;
  counterCode?: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
  isActive: boolean;
  location?: LocationDto;
}

export interface CreateTicketCounterDto {
  locationId: string;
  counterName: string;
  counterCode?: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
  isActive?: boolean;
}

export interface UpdateTicketCounterDto {
  counterName: string;
  counterCode?: string;
  addressDetails?: string;
  contactNumber?: string;
  operatingHours?: string;
  isActive: boolean;
}