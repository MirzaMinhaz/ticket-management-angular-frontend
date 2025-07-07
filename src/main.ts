// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component'; // Your root standalone component
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes'; // Your application routes
import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core'; // For NgModule-based services
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // For Toastr
import { ToastrModule } from 'ngx-toastr'; // For Toastr


bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    importProvidersFrom(
      BrowserAnimationsModule, // Required for Toastr animations
      ToastrModule.forRoot({
        positionClass: 'toast-bottom-right', // Configure as needed
        preventDuplicates: true,
        closeButton: true
      })
    )
    // ... any other root-level service providers
  ]
})
.catch(err => console.error(err));