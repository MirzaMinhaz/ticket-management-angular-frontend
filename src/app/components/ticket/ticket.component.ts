import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TicketDto,
  RouteDto,
  Vehicle,
  OperatorDto,
  ScheduleDto
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.css']
})
export class TicketComponent implements OnInit {
  tickets: TicketDto[] = [];
  paginatedTickets: TicketDto[] = [];
  selectedTicket: TicketDto = this.emptyTicket();

  // Inherited schedule fields
  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];

  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  selectedDepartureDateTime: string = '';
  selectedArrivalDateTime: string = '';
  selectedBaseFare: number = 0;

  availableVehicles: Vehicle[] = [];

  successMessage: string | null = null;
  modalSuccessMessage: string | null = null;

  showModal = false;
  showDeleteConfirmModal = false;
  ticketToDelete: TicketDto | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];

  constructor(
    private ngZone: NgZone,
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService
  ) {}

  ngOnInit(): void {
    this.loadRoutes();
    this.loadVehicles();
    this.loadOperators();
    this.loadSchedules();
    this.updatePagination();
  }

  // Load data
  loadRoutes(): void {
    this.routeService.getAllRoutes().subscribe({
      next: data => this.routes = data,
      error: err => console.error('Failed to load routes', err)
    });
  }

  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: data => this.vehicles = data,
      error: err => console.error('Failed to load vehicles', err)
    });
  }

  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: data => this.operators = data,
      error: err => console.error('Failed to load operators', err)
    });
  }

  loadSchedules(): void {
    this.scheduleService.getAllSchedules().subscribe({
      next: data => this.schedules = data,
      error: err => console.error('Failed to load schedules', err)
    });
  }

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    const op = this.operators.find(o => o.operatorCode === operatorCode);
    return op ? op.name : '';
  }

  // Calculate arrival time based on route duration
  calculateArrivalTime(): void {
  if (!this.selectedDepartureDateTime || !this.selectedRouteCode) return;

  const route = this.routes.find(r => r.id === Number(this.selectedRouteCode));
  if (!route || !route.estimatedDurationHours) return;

  const departure = new Date(this.selectedDepartureDateTime);
  const arrival = new Date(departure.getTime() + route.estimatedDurationHours * 60 * 60 * 1000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  this.selectedArrivalDateTime = `${arrival.getFullYear()}-${pad(arrival.getMonth() + 1)}-${pad(arrival.getDate())}T${pad(arrival.getHours())}:${pad(arrival.getMinutes())}`;

  // ✅ Fix: normalize schedule departure times
  this.availableVehicles = this.vehicles.filter(v =>
    this.schedules.some(s =>
      s.routeId === Number(this.selectedRouteCode) &&
      s.vehicleId === v.id &&
      new Date(s.departureDateTime).getTime() === departure.getTime()
    )
  );
}


  // Fill base fare when vehicle is selected
  fillBaseFare(): void {
  const departure = new Date(this.selectedDepartureDateTime);

  const schedule = this.schedules.find(s =>
    s.routeId === Number(this.selectedRouteCode) &&
    s.vehicleId === Number(this.selectedVehicleCode) &&
    new Date(s.departureDateTime).getTime() === departure.getTime()
  );

  if (schedule) {
    this.selectedBaseFare = schedule.baseFare;
  }
}


  emptyTicket(): TicketDto {
    return {
      id: 0,
      passengerName: '',
      passengerContact: '',
      seatNumber: '',
      farePaid: 0,
      bookingDateTime: '',
      bookingCounterId: '',
      departureCounterId: '',
      arrivalCounterId: '',
      createdAt: '',
      createdBy: ''
    };
  }

  save(): void {
    if (this.selectedTicket.id) {
      const index = this.tickets.findIndex(t => t.id === this.selectedTicket.id);
      if (index !== -1) {
        this.tickets[index] = { ...this.selectedTicket };
        this.modalSuccessMessage = 'Ticket updated successfully!';
        setTimeout(() => {
          this.modalSuccessMessage = null;
          this.closeModal();
        }, 1500);
      }
    } else {
      this.selectedTicket.id = Date.now();
      // Attach inherited schedule fields
      this.selectedTicket.departureCounterId = this.selectedDepartureDateTime;
      this.selectedTicket.arrivalCounterId = this.selectedArrivalDateTime;
      this.selectedTicket.farePaid = this.selectedBaseFare;

      this.tickets.push({ ...this.selectedTicket });
      this.successMessage = 'Ticket added successfully!';
      setTimeout(() => (this.successMessage = null), 2000);
    }

    this.reset();
    this.updatePagination();
  }

  reset(): void {
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDateTime = '';
    this.selectedArrivalDateTime = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
  }

  openModal(ticket: TicketDto): void {
    this.selectedTicket = { ...ticket };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedTicket = this.emptyTicket();
  }

  confirmDelete(ticket: TicketDto): void {
    this.ticketToDelete = ticket;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmModal = false;
    this.ticketToDelete = null;
  }

  deleteConfirmed(): void {
    if (this.ticketToDelete) {
      this.tickets = this.tickets.filter(t => t.id !== this.ticketToDelete!.id);
      this.successMessage = 'Ticket deleted successfully!';
      setTimeout(() => (this.successMessage = null), 2000);
      this.updatePagination();
    }
    this.cancelDelete();
  }

  sortBy(field: keyof TicketDto): void {
    this.tickets.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    });
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.tickets.length / this.itemsPerPage) || 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.goToPage(this.currentPage);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (page - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedTickets = this.tickets.slice(start, end);
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }
}
