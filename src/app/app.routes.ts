import { Routes } from '@angular/router';

// Layouts
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { CustomerLayoutComponent } from './layouts/customer-layout/customer-layout.component';

// Guards
import { adminGuard } from './guards/admin.guard';
import { customerGuard } from './guards/customer.guard';

// Admin pages (existing — untouched)
import { HomeComponent } from './components/home/home.component';
import { LocationsListComponent } from './components/locations-list/locations-list.component';
import { TicketCounterEntryComponent } from './components/ticket-counter-entry/ticket-counter-entry.component';
import { VehicleComponent } from './components/vehicles/vehicles';
import { OperatorComponent } from './components/operators/operators';
import { SeatBookingComponent } from './components/seat-booking/seat-booking.component';
import { TicketComponent } from './components/ticket/ticket.component';
import { TrainTicketComponent } from './components/train-ticket/train-ticket.component';
import { RoutesComponent } from './components/routes/routes.component';
import { ScheduleComponent } from './components/schedule/schedule.component';

// Auth pages
import { AuthComponent } from './components/auth/auth.component';
import { CustomerLoginComponent } from './components/customer/customer-login/customer-login.component';

import { CustomerHomeComponent } from './components/customer/customer-home/customer-home.component';
import { CustomerProfileComponent } from './components/customer/customer-profile/customer-profile.component';
import { CustomerMyTicketsComponent } from './components/customer/customer-my-tickets/customer-my-tickets.component';

// ← NEW: customer-only booking component (split out from the admin TicketComponent)
import { CustomerTicketComponent } from './components/customer-ticket/customer-ticket.component';
import { CustomerTrainTicketComponent } from './components/customer-train-ticket/customer-train-ticket.component';

export const routes: Routes = [
  // ── Public ──────────────────────────────────────
  { path: '', component: AuthComponent },
  { path: 'customer/login', component: CustomerLoginComponent },

  // ── Admin (existing routes, now under AdminLayout + adminGuard) ──
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'locations', component: LocationsListComponent },
      { path: 'ticket-counters/entry', component: TicketCounterEntryComponent },
      {
        path: 'ticket-counters/edit/:id',
        component: TicketCounterEntryComponent,
      },
      { path: 'vehicles', component: VehicleComponent },
      { path: 'operators', component: OperatorComponent },
      { path: 'routes', component: RoutesComponent },
      { path: 'schedules', component: ScheduleComponent },
      { path: 'seat-booking/:vehicleId', component: SeatBookingComponent },
      { path: 'ticket', component: TicketComponent },
      { path: 'trainTicket', component: TrainTicketComponent },
    ],
  },

  // ── Customer (new, under CustomerLayout + customerGuard) ──
  {
    path: 'customer',
    component: CustomerLayoutComponent,
    canActivate: [customerGuard],
    children: [
      { path: 'home', component: CustomerHomeComponent },
      // Add more customer pages here as you build them:
      { path: 'bus-booking', component: CustomerTicketComponent }, // ← was TicketComponent
      // { path: 'train-booking', component: TrainTicketComponent },
      { path: 'train-booking', component: CustomerTrainTicketComponent }, // ← was TrainTicketComponent
      { path: 'my-tickets', component: CustomerMyTicketsComponent },
      { path: 'profile', component: CustomerProfileComponent },
    ],
  },

  { path: '**', redirectTo: '' },
];