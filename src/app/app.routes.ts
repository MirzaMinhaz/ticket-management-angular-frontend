// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LocationsListComponent } from './components/locations-list/locations-list.component';
import { TicketCounterEntryComponent } from './components/ticket-counter-entry/ticket-counter-entry.component';
import { VehicleComponent } from './components/vehicles/vehicles';
import { OperatorComponent } from './components/operators/operators';
import { SeatBookingComponent } from './components/seat-booking/seat-booking.component';
import { TicketComponent } from './components/ticket/ticket.component';
import { RoutesComponent } from './components/routes/routes.component';
import { ScheduleComponent } from './components/schedule/schedule.component';
import { AuthComponent } from './components/auth/auth.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Public route: login page
  { path: '', component: AuthComponent },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'locations', component: LocationsListComponent, canActivate: [authGuard] },
  { path: 'ticket-counters/entry', component: TicketCounterEntryComponent, canActivate: [authGuard] },
  { path: 'ticket-counters/edit/:id', component: TicketCounterEntryComponent, canActivate: [authGuard] },
  { path: 'vehicles', component: VehicleComponent, canActivate: [authGuard] },
  { path: 'operators', component: OperatorComponent, canActivate: [authGuard] },
  { path: 'routes', component: RoutesComponent, canActivate: [authGuard] },
  { path: 'schedules', component: ScheduleComponent, canActivate: [authGuard] },
  { path: 'seat-booking/:vehicleId', component: SeatBookingComponent, canActivate: [authGuard] },
  { path: 'ticket', component: TicketComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
