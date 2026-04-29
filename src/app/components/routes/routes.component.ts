import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LocationDto, RouteDto, CreateRouteDto, UpdateRouteDto } from '../../models/common';
import { Observable } from 'rxjs';
import { LocationService } from '../../services/location.service';
import { RouteService } from '../../services/route.service';

@Component({
  selector: 'app-routes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './routes.component.html',
  styleUrls: ['./routes.component.css']
})

export class RoutesComponent implements OnInit {
  routes: RouteDto[] = [];
  routeForm!: FormGroup;
  selectedLocationCode: string = '';
  selectedRoute: RouteDto = this.getEmptyRoute();
  locations: LocationDto[] = [];

  successMessage: string = '';
  modalSuccessMessage: string = '';
  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 25;
  sortField: string = '';
  sortAsc: boolean = true;

  routeToDelete: RouteDto | null = null;
  showDeleteConfirmModal: boolean = false;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService,
    private routeService: RouteService,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadRoutes();

    this.routeForm = this.fb.group({
      departureLocation: ['', Validators.required],
      destinationLocation: ['', Validators.required],
      routeName: [{ value: '', disabled: true }, Validators.required],
      estimatedDurationHours: ['', [Validators.required, Validators.min(0)]]

    });

    this.routeForm.valueChanges.subscribe(val => {
      const departureName = this.locations.find(l => l.locationCode === val.departureLocation)?.name || '';
      const destinationName = this.locations.find(l => l.locationCode === val.destinationLocation)?.name || '';

      if (departureName && destinationName) {
        this.routeForm.get('routeName')?.setValue(`${departureName} - ${destinationName}`, { emitEvent: false });
      } else if (departureName) {
        this.routeForm.get('routeName')?.setValue(`${departureName} -`, { emitEvent: false });
      } else {
        this.routeForm.get('routeName')?.setValue('', { emitEvent: false });
      }
    });
    this.loadLocations();
  }

  loadRoutes(): void {
    this.routeService.getAllRoutes().subscribe({
      next: data => this.routes = data,
      error: err => console.error('Failed to load routes', err)
    });
  }


  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: data => this.locations = data,
      error: err => console.error('Failed to load locations', err)
    });
  }

   get paginatedCounters(): RouteDto[] {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      return this.routes.slice(start, start + this.itemsPerPage);
    }

    getDepartureLocationName(code: string | undefined): string | undefined {
    return this.locations.find(loc => loc.locationCode === code)?.name;
  }


  openModal(route: RouteDto): void {
    this.selectedRoute = { ...route };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }


 confirmDelete(route: RouteDto): void {
  this.routeToDelete = route;
  this.showDeleteConfirmModal = true;
}

cancelDelete(): void {
  this.routeToDelete = null;
  this.showDeleteConfirmModal = false;
}


  errorMessage: string = '';


  save(): void {

    const formValue = this.routeForm.getRawValue();

    this.selectedRoute.departureLocationCode = formValue.departureLocation;
    this.selectedRoute.destinationLocationCode = formValue.destinationLocation;
    this.selectedRoute.routeName = formValue.routeName;
    this.selectedRoute.estimatedDurationHours = formValue.estimatedDurationHours;

    if (this.selectedRoute.id > 0) {
      const updateDto: UpdateRouteDto = {
        departureLocationCode: this.selectedRoute.departureLocationCode,
        destinationLocationCode: this.selectedRoute.destinationLocationCode,
        routeName: this.selectedRoute.routeName,
        estimatedDurationHours: this.selectedRoute.estimatedDurationHours
      };

      this.routeService.updateRoute(this.selectedRoute.id, updateDto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Route updated successfully!';
          this.loadRoutes();

          setTimeout(() => {
            this.ngZone.run(() => {
              this.closeModal();
              this.modalSuccessMessage = '';
            });
          }, 2000);
        },
        error: err => console.error('Failed to update route', err)
      });

    } else {
      const createDto: CreateRouteDto = {
        departureLocationCode: this.selectedRoute.departureLocationCode,
        destinationLocationCode: this.selectedRoute.destinationLocationCode,
        routeName: this.selectedRoute.routeName,
        estimatedDurationHours: this.selectedRoute.estimatedDurationHours
      };

      this.routeService.createRoute(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Route created successfully!';
          this.errorMessage = ''; // clear error
          this.loadRoutes();
          this.reset();
          this.autoClearMessage();
        }, error: err => {
          console.error('Failed to create route', err);
          this.errorMessage = err.error?.message || '❌ Failed to create route.';
          setTimeout(() => { this.errorMessage = ''; }, 2000);
        }
      });
    }
  }


  reset(): void {
    this.selectedRoute = this.getEmptyRoute();
    this.routeForm.reset({
      departureLocation: '',
      destinationLocation: '',
      routeName: '',
      estimatedDurationHours: ''
    });
  }


  getEmptyRoute(): RouteDto {
    return {
      id: 0,
      departureLocationCode: '',
      destinationLocationCode: '',
      routeName: '',
      estimatedDurationHours: 0
    };
  }


  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
  }

  sortBy(field: keyof RouteDto): void {
      if (this.sortField === field) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortField = field;
        this.sortAsc = true;
      }
  
      this.routes.sort((a, b) => {
        const valA = a[field]?.toString().toLowerCase() ?? '';
        const valB = b[field]?.toString().toLowerCase() ?? '';
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

}