import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TicketDto,
  CreateTicketDto,
  UpdateTicketDto,
  RouteDto,
  Vehicle,
  OperatorDto,
  ScheduleDto,
  TicketCounterDto,
  SeatDto
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketService } from '../../services/ticket.service';

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

  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  counters: TicketCounterDto[] = [];

  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  selectedCounterCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

  availableVehicles: Vehicle[] = [];

  successMessage: string | null = null;
  modalSuccessMessage: string | null = null;

  showModal = false;
  showDeleteConfirmModal = false;
  ticketToDelete: TicketDto | null = null;

  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];

  // 🔹 Seat Booking State
  seatBookingBusId: number | null = null;
  seats: SeatDto[] = [];
  seatMap: Record<string, SeatDto> = {};
  selectedSeats: SeatDto[] = [];
  rows: string[] = [];

  constructor(
    private ngZone: NgZone,
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ticketCounterService: TicketCounterService,
    private ticketService: TicketService,
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.loadVehicles();
    this.loadOperators();
    this.loadSchedules();
    this.loadCounters();
    this.updatePagination();

    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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

  loadCounters(): void {
    this.ticketCounterService.getAllTicketCounters().subscribe({
      next: data => this.counters = data,
      error: err => console.error('Failed to load counters', err)
    });
  }


  loadTickets(): void {
    this.ticketService.getTickets().subscribe({
      next: data => {
        this.tickets = data.map(t => ({
          ...t,
          createdBy: t.createdBy ?? 'System'  // fallback value
        }));
      },
      error: err => console.error('Failed to load tickets', err)
    });
  }



  //   loadTickets(): void {
  //   this.ticketService.getTickets().subscribe({
  //     next: data => { this.tickets = data;
  //       this.updatePagination();
  //     },
  //     error: err => console.error('Failed to load tickets', err)
  //   });
  // }



  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    const op = this.operators.find(o => o.operatorCode === operatorCode);
    return op ? op.name : '';
  }

  calculateArrivalDate(): void {
    if (!this.selectedDepartureDate || !this.selectedRouteCode) return;

    const route = this.routes.find(r => r.id === Number(this.selectedRouteCode));
    if (!route || !route.estimatedDurationHours) return;

    const departureDate = new Date(this.selectedDepartureDate);
    const arrivalDate = new Date(departureDate.getTime() + route.estimatedDurationHours * 60 * 60 * 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.selectedArrivalDate = `${arrivalDate.getFullYear()}-${pad(arrivalDate.getMonth() + 1)}-${pad(arrivalDate.getDate())}`;

    this.availableVehicles = this.vehicles.filter(v =>
      this.schedules.some(s => s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id)
    );
  }

  fillBaseFare(): void {
    const schedule = this.schedules.find(s =>
      s.routeId === Number(this.selectedRouteCode) &&
      s.vehicleId === this.vehicles.find(v => v.vehicleCode === this.selectedVehicleCode)?.id
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
      bookingDateTime: this.getTodayDateString(),
      bookingCounterId: 0,
      departureCounterId: 0,
      arrivalCounterId: 0,
      createdAt: '',
      createdBy: ''
    };
  }

  // save(): void {
  //   if (this.selectedTicket.id) {
  //     const index = this.tickets.findIndex(t => t.id === this.selectedTicket.id);
  //     if (index !== -1) {
  //       this.tickets[index] = { ...this.selectedTicket };
  //       this.modalSuccessMessage = 'Ticket updated successfully!';
  //       setTimeout(() => {
  //         this.modalSuccessMessage = null;
  //         this.closeModal();
  //       }, 1500);
  //     }
  //   } else {
  //     this.selectedTicket.id = Date.now();
  //     this.selectedTicket.departureCounterId = this.selectedDepartureDate;
  //     this.selectedTicket.arrivalCounterId = this.selectedArrivalDate;
  //     this.selectedTicket.farePaid = this.selectedBaseFare;

  //     this.tickets.push({ ...this.selectedTicket });
  //     this.successMessage = 'Ticket added successfully!';
  //     setTimeout(() => (this.successMessage = null), 2000);
  //   }

  //   this.reset();
  //   this.updatePagination();
  // }

  save(): void {
    if (this.selectedTicket.id) {
      // Build the update request object
      const updateRequest: UpdateTicketDto = {
        id: this.selectedTicket.id,
        passengerName: this.selectedTicket.passengerName,
        passengerContact: this.selectedTicket.passengerContact,
        seatNumber: this.selectedTicket.seatNumber,
        farePaid: this.selectedTicket.farePaid,
        bookingDateTime: this.selectedTicket.bookingDateTime,
        bookingCounterId: Number(this.selectedTicket.bookingCounterId),
        departureCounterId: Number(this.selectedTicket.departureCounterId),
        arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
      };

      this.ticketService.updateTicket(updateRequest).subscribe({
        next: () => {
          this.loadTickets();
          this.modalSuccessMessage = 'Ticket updated successfully!';
          setTimeout(() => {
            this.modalSuccessMessage = null;
            this.closeModal();
          }, 1500);
        },
        error: err => console.error('Failed to update ticket', err)
      });
    } else {
      // Build the create request object
      const createRequest: CreateTicketDto = {
        id: 0,
        passengerName: this.selectedTicket.passengerName,
        passengerContact: this.selectedTicket.passengerContact,
        seatNumber: this.selectedTicket.seatNumber,
        farePaid: this.selectedTicket.farePaid,
        bookingDateTime: this.selectedTicket.bookingDateTime,
        bookingCounterId: Number(this.selectedTicket.bookingCounterId),
        departureCounterId: Number(this.selectedTicket.departureCounterId),
        arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
      };

      this.ticketService.createTicket(createRequest).subscribe({
        next: () => {
          this.loadTickets();
          this.successMessage = 'Ticket added successfully!';
          setTimeout(() => (this.successMessage = null), 2000);
        },
        error: err => console.error('Failed to save ticket', err)
      });
    }

    this.reset();
  }




  reset(): void {
    if (this.selectedSeats.length) {
      this.selectedSeats.forEach(s => (s.status = 'available'));
    }
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.seatBookingBusId = null;
    this.seats = [];
    this.selectedSeats = [];
    this.rows = [];
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

  getDepartureTimeForVehicle(vehicleId: number): string {
    const schedule = this.schedules.find(
      s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode)
    );
    if (!schedule) return '';
    return new Date(schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getArrivalTimeForVehicle(vehicleId: number): string {
    const schedule = this.schedules.find(
      s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode)
    );
    return schedule
      ? new Date(schedule.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  getBaseFareForVehicle(vehicleId: number): number | null {
    const schedule = this.schedules.find(
      s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode)
    );
    return schedule ? schedule.baseFare : null;
  }

  getSeatsForVehicle(vehicleId: number): number | null {
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    return vehicle ? vehicle.capacity : null;
  }

  openDatePicker(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input && typeof input.showPicker === 'function') {
      input.showPicker();
    }
  }

  getSeatClass(vehicleId: any): string {
    const seats = this.getSeatsForVehicle(vehicleId);
    if (seats === null || seats === undefined) {
      return 'high';
    }
    return seats < 5 ? 'low' : 'high';
  }

  // 🔹 Seat Booking Methods
  toggleSeatBooking(vehicleId: number): void {
    if (this.seatBookingBusId === vehicleId) {
      // collapse if already open
      this.seatBookingBusId = null;
      this.seats = [];
      this.selectedSeats = [];
      this.rows = [];
    } else {
      this.seatBookingBusId = vehicleId;
      const vehicle = this.vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        this.generateSeats(vehicle.capacity ?? 40);
      }
    }
  }

  private generateSeats(capacity: number): void {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

    for (let r = 0; count < capacity && r < alphabet.length; r++) {
      const row = alphabet[r];
      for (let c = 1; c <= 4 && count < capacity; c++) {
        count++;
        seats.push({
          id: count,
          seatNumber: `${row}${c}`,
          seatCode: `${row}${c}`,
          isBooked: false,
          status: 'available'
        });
      }
    }

    if (capacity % 2 !== 0) {
      const idx = seats.findIndex(s => s.seatNumber === 'A1');
      if (idx !== -1) seats.splice(idx, 1);
    }

    if (seats.length) {
      const lastRow = seats[seats.length - 1].seatNumber.charAt(0);
      const lastRowSeats = seats.filter(s => s.seatNumber.charAt(0) === lastRow);
      const existingCols = new Set(lastRowSeats.map(s => parseInt(s.seatNumber.substring(1), 10)));
      for (let c = 1; c <= 4; c++) {
        if (!existingCols.has(c)) {
          count++;
          seats.push({
            id: count,
            seatNumber: `${lastRow}${c}`,
            seatCode: `${lastRow}${c}`,
            isBooked: false,
            status: 'available'
          });
        }
      }
    }

    this.seats = seats;
    this.prepareSeatMap(seats);
  }

  private prepareSeatMap(seats: SeatDto[]): void {
    seats.sort((a, b) => {
      const ra = a.seatNumber.charAt(0);
      const rb = b.seatNumber.charAt(0);
      if (ra !== rb) return ra.charCodeAt(0) - rb.charCodeAt(0);
      return parseInt(a.seatNumber.substring(1), 10) - parseInt(b.seatNumber.substring(1), 10);
    });

    this.rows = Array.from(new Set(seats.map(s => s.seatNumber.charAt(0))));
    this.seatMap = {};
    for (const s of seats) {
      this.seatMap[s.seatNumber] = s;
    }
  }

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }


  private updateSeatNumberField(): void {
    // 1. Sync the Seat Number string
    const seatString = this.selectedSeats
      .map(s => s.seatNumber)
      .sort()
      .join(', ');
    this.selectedTicket.seatNumber = seatString;

    // 2. Ensure we have the fare from the active schedule
    if (this.seatBookingBusId) {
      const schedule = this.schedules.find(s =>
        s.vehicleId === this.seatBookingBusId &&
        s.routeId === Number(this.selectedRouteCode)
      );
      if (schedule) {
        this.selectedBaseFare = schedule.baseFare;
      }
    }

    // 3. Calculate Total
    this.selectedTicket.farePaid = (this.selectedBaseFare || 0) * this.selectedSeats.length;
  }



  getSeatByPosition(row: string, col: number): SeatDto | undefined {
    return this.seatMap?.[`${row}${col}`];
  }

  toggleSeat(seat: SeatDto): void {
    if (!seat || seat.status === 'reserved') return;

    // Find the seat in our master seatMap to ensure we are updating the reference
    const mapSeat = this.seatMap[seat.seatNumber];

    if (mapSeat.status === 'selected') {
      mapSeat.status = 'available'; // Mark it available in the grid
      this.selectedSeats = this.selectedSeats.filter(s => s.seatNumber !== seat.seatNumber);
    } else {
      if (this.selectedSeats.length >= 5) {
        alert('You can only select a maximum of 5 seats.');
        return;
      }
      mapSeat.status = 'selected'; // Mark it selected in the grid
      this.selectedSeats = [...this.selectedSeats, mapSeat];
    }

    this.updateSeatNumberField();
  }


  clearSelection(): void {
    this.selectedSeats.forEach(s => (s.status = 'available'));
    this.selectedSeats = [];
    this.selectedTicket.seatNumber = '';
  }

  // 3. Update confirmBooking to finalize the selection
  // confirmBooking(): void {
  //   if (!this.selectedSeats.length) return;

  //   this.updateSeatNumberField();
  //   this.selectedSeats.forEach(s => (s.status = 'selected'));
  //   this.seatBookingBusId = null;
  //   // this.selectedSeats = [];
  // }

  confirmBooking(): void {
    if (!this.selectedSeats.length) return;

    // Final sync of the fields
    this.updateSeatNumberField();

    // We keep the status as 'selected' so the CSS class stays active
    this.selectedSeats.forEach(s => (s.status = 'selected'));

    // Close the seat picker UI
    this.seatBookingBusId = null;

    // ⚠️ CRITICAL: Do NOT clear this.selectedSeats = []; 
    // If you clear it, the [class.selected] in your HTML will disappear.
  }

  trackRow(index: number, row: string) { return row; }
  trackCol(index: number, col: number) { return col; }
}
