// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component'; // Path: ./components/home/home.component
import { LocationsListComponent } from './components/locations-list/locations-list.component'; // Path: ./components/locations-list/locations-list.component
import { TicketCountersListComponent } from './components/ticket-counters-list/ticket-counters-list.component'; // Path: ./components/ticket-counters-list/ticket-counters-list.component
import { TicketCounterEntryComponent } from './components/ticket-counter-entry/ticket-counter-entry.component'; // Path: ./components/ticket-counter-entry/ticket-counter-entry.component
import { VehicleComponent } from './components/vehicles/vehicles'; // ✅ Path: ./components/vehicle/vehicle.ts

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'locations', component: LocationsListComponent },
  { path: 'ticket-counters', component: TicketCountersListComponent },
  { path: 'ticket-counters/entry', component: TicketCounterEntryComponent },
  { path: 'ticket-counters/edit/:id', component: TicketCounterEntryComponent },
  { path: 'vehicles', component: VehicleComponent }, // ✅ Added Vehicle route
  { path: '**', redirectTo: '' }
];
