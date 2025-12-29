import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../services/location.service';
import { LocationDto, CreateLocationDto, UpdateLocationDto } from '../../models/common';
import { NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.css']
})
export class LocationsListComponent implements OnInit {
  locations: LocationDto[] = [];
  selectedLocation: LocationDto = this.getEmptyLocation();
  successMessage: string = '';
  modalSuccessMessage: string = '';

  showDeleteConfirmModal: boolean = false;
  LocationToDelete: LocationDto | null = null;




  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: string = '';
  sortAsc: boolean = true;

  constructor(private locationService: LocationService,
    private ngZone: NgZone,
    private router: Router   // ✅ add router
  ) { }

  ngOnInit(): void {
    this.loadlocations();

  }



  get paginatedlocations(): LocationDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.locations.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.locations.length / this.itemsPerPage);
  }

  loadlocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: data => this.locations = data,
      error: err => console.error('Failed to load locations', err)
    });
  }

  openModal(Location: LocationDto): void {
    this.selectedLocation = { ...Location };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  confirmDelete(Location: LocationDto): void {
    this.LocationToDelete = Location;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.LocationToDelete = null;
    this.showDeleteConfirmModal = false;
  }

  autoClearModalMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.modalSuccessMessage = '';
      });
    }, 3000);
  }


  save(): void {

    if (this.selectedLocation.locationId > 0) {
      const updateDto: UpdateLocationDto = {
        name: this.selectedLocation.name,
        type: this.selectedLocation.type,
        address: this.selectedLocation.address
      };

      this.locationService.updateLocation(this.selectedLocation.locationId, updateDto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Location updated successfully!';
          this.loadlocations();

          // Delay modal close to show success message
          setTimeout(() => {
            this.ngZone.run(() => {
              this.closeModal();
              this.modalSuccessMessage = '';
            });
          }, 2000); // Show message for 2 seconds
        },
        error: err => console.error('Failed to update Location', err)
      });
    } else {
      const createDto: CreateLocationDto = {
        name: this.selectedLocation.name,
        type: this.selectedLocation.type,
        address: this.selectedLocation.address
      };

      this.locationService.createLocation(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Location created successfully!';
          this.loadlocations();
          this.reset();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to create Location', err)
      });
    }
  }

  deleteConfirmed(): void {
    if (!this.LocationToDelete) return;

    this.locationService.deleteLocation(this.LocationToDelete.locationId).subscribe({
      next: () => {
        this.loadlocations();
        this.showDeleteConfirmModal = false;
        this.LocationToDelete = null;
        this.successMessage = '🗑️ Location deleted successfully!';
        this.autoClearMessage();
      },
      error: err => console.error('Failed to delete Location', err)
    });
  }


  delete(id: number): void {
    this.locationService.deleteLocation(id).subscribe({
      next: () => this.loadlocations(),
      error: err => console.error('Failed to delete Location', err)
    });
  }

  reset(): void {
    this.selectedLocation = this.getEmptyLocation();
  }

  getEmptyLocation(): LocationDto {
    return {
      locationId: 0,
      locationCode: '',
      name: '',
      type: '',
      address: '',
      createdAt: '',
      lastModifiedAt: '',
      createdBy: '',
      lastModifiedBy: ''
    };
  }

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }


  sortBy(field: keyof Location): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
  }
}
