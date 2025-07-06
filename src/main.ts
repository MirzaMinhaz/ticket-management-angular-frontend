// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideRouter, Routes } from '@angular/router'; // <--- Add this import

import { AppComponent } from './app/app.component'; // Your root component
import { LocationsListComponent } from '../src/app/components/locations-list/locations-list.component';

// Define your application routes
const routes: Routes = [
  { path: 'locations', component: LocationsListComponent },
  // Add a redirect for the root path if desired
  { path: '', redirectTo: '/locations', pathMatch: 'full' },
  // Handle any other undefined routes (optional)
  // { path: '**', component: NotFoundComponent } // You would need to create a NotFoundComponent
];

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    provideToastr({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      progressBar: true
    }),
    provideRouter(routes) // <--- Add this line to provide router services
  ]
}).catch(err => console.error(err));