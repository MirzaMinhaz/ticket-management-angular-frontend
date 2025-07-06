// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // Import provideHttpClient
import { ReactiveFormsModule } from '@angular/forms'; // Import ReactiveFormsModule

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(), // Provide HttpClient for the entire app
    importProvidersFrom(ReactiveFormsModule) // Import ReactiveFormsModule
  ]
};