import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto, LocationDto } from '../../models/common';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-ticket-counter-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-counter-entry.component.html',
  styleUrls: ['./ticket-counter-entry.component.css']
})
export class TicketCounterEntryComponent implements OnInit {
  counters: TicketCounterDto[] = [];
  selectedCounter: TicketCounterDto = this.getEmptyCounter();
  selectedLocationCode: string = '';
  locations: LocationDto[] = [];

  successMessage: string = '';
  modalSuccessMessage: string = '';
  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: string = '';
  sortAsc: boolean = true;

  counterToToDelete: TicketCounterDto | null = null;
    showDeleteConfirmModal: boolean = false;

  constructor(
    private counterService: TicketCounterService,
    private locationService: LocationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadCounters();
    this.loadLocations();
  }

  loadCounters(): void {
    this.counterService.getAllTicketCounters().subscribe({
      next: data => this.counters = data,
      error: err => console.error('Failed to load counters', err)
    });
  }

  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: data => this.locations = data,
      error: err => console.error('Failed to load locations', err)
    });
  }

  get paginatedCounters(): TicketCounterDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.counters.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.counters.length / this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  getLocationName(code: string | undefined): string | undefined {
    return this.locations.find(loc => loc.locationCode === code)?.name;
  }

  openModal(counter: TicketCounterDto): void {
    this.selectedCounter = { ...counter };
    this.selectedLocationCode = counter.locationCode;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }


 confirmDelete(ticketCounter: TicketCounterDto): void {
  this.counterToToDelete = ticketCounter;
  this.showDeleteConfirmModal = true;
}

cancelDelete(): void {
  this.counterToToDelete = null;
  this.showDeleteConfirmModal = false;
}

  save(): void {
    if (this.selectedCounter.id>0) {
      const updateDto: UpdateTicketCounterDto = {
        locationCode: this.selectedLocationCode,
        counterName: this.selectedCounter.counterName,
        addressDetails: this.selectedCounter.addressDetails,
        contactNumber: this.selectedCounter.contactNumber
      };

      this.counterService.updateTicketCounter(this.selectedCounter.id, updateDto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Counter updated successfully!';
          this.loadCounters();

          setTimeout(() => {
            this.ngZone.run(() => {
              this.closeModal();
              this.modalSuccessMessage = '';
            });
          }, 2000);
        },
        error: err => console.error('Failed to update counter', err)
      });

    } else {
      const createDto: CreateTicketCounterDto = {
        locationCode: this.selectedLocationCode,
        counterName: this.selectedCounter.counterName,
        addressDetails: this.selectedCounter.addressDetails,
        contactNumber: this.selectedCounter.contactNumber
      };

      this.counterService.createTicketCounter(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Counter created successfully!';
          this.loadCounters();
          this.reset();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to create counter', err)
      });
    }
  }



  deleteConfirmed(): void {
  if (!this.counterToToDelete) return;

  this.counterService.deleteTicketCounter(this.counterToToDelete.id).subscribe({
    next: () => {
      this.loadCounters();
      this.showDeleteConfirmModal = false;
      this.counterToToDelete = null;
      this.successMessage = '🗑️ Ticket Counter deleted successfully!';
      this.autoClearMessage();
    },
    error: err => console.error('Failed to delete Ticket Counter', err)
  });
}

  delete(id: number): void {
    this.counterService.deleteTicketCounter(id).subscribe({
      next: () => this.loadCounters(),
      error: err => console.error('Failed to delete counter', err)
    });
  }

  reset(): void {
    this.selectedCounter = this.getEmptyCounter();
    this.selectedLocationCode = '';
  }

  getEmptyCounter(): TicketCounterDto {
    return {
      id: 0,
      locationCode: '',
      counterName: '',
      counterCode: '',
      addressDetails: '',
      contactNumber: '',
      operatingHours: '',
      isActive: true,
      createdAt: '',
      createdBy: ''
    };
  }

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
  }

  sortBy(field: keyof TicketCounterDto): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.counters.sort((a, b) => {
      const valA = a[field]?.toString().toLowerCase() ?? '';
      const valB = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }
}
