import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import {
  ScheduleDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  Vehicle,
  OperatorDto,
  RouteDto
} from '../../models/common';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css']
})
export class ScheduleComponent implements OnInit {
  schedules: ScheduleDto[] = [];
  selectedSchedule: ScheduleDto = this.getEmptySchedule();
  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];

  successMessage: string = '';
  modalSuccessMessage: string = '';
  showModal: boolean = false;

  scheduleToDelete: ScheduleDto | null = null;
  showDeleteConfirmModal: boolean = false;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 25;
  sortField: string = '';
  sortAsc: boolean = true;

  constructor(
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadSchedules();
    this.loadRoutes();
    this.loadVehicles();
    this.loadOperators();
  }

  // Load schedules
  loadSchedules(): void {
    this.scheduleService.getAllSchedules().subscribe({
      next: data => this.schedules = data,
      error: err => console.error('Failed to load schedules', err)
    });
  }

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

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    const op = this.operators.find(o => o.operatorCode === operatorCode);
    return op ? op.name : '';
  }

  // Pagination helpers
  get paginatedSchedules(): ScheduleDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.schedules.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.schedules.length / this.itemsPerPage);
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

  // Modal handling
  openModal(schedule: ScheduleDto): void {
    this.selectedSchedule = { ...schedule };
    this.selectedRouteCode = schedule.routeId.toString();
    this.selectedVehicleCode = schedule.vehicleId.toString();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  // Convert "HH:mm" string to ISO DateTime
  private wrapTimeToISO(timeStr: string): string {
    if (!timeStr) return '';
    const today = new Date();
    const [hour, minute] = timeStr.split(':').map(Number);

    // Construct a local datetime
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute);

    // Format as "YYYY-MM-DDTHH:mm:ss" (no Z, no UTC conversion)
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
  }


  // Save (create/update)
  save(): void {
    if (this.selectedSchedule.id > 0) {
      const updateDto: UpdateScheduleDto = {
        routeId: Number(this.selectedRouteCode),
        vehicleId: Number(this.selectedVehicleCode),
        departureDateTime: this.wrapTimeToISO(this.selectedSchedule.departureDateTime),
        arrivalDateTime: this.wrapTimeToISO(this.selectedSchedule.arrivalDateTime),
        baseFare: this.selectedSchedule.baseFare,
        status: this.selectedSchedule.status || 'Scheduled'
      };

      this.scheduleService.updateSchedule(this.selectedSchedule.id, updateDto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Schedule updated successfully!';
          this.loadSchedules();
          setTimeout(() => {
            this.ngZone.run(() => {
              this.closeModal();
              this.modalSuccessMessage = '';
            });
          }, 2000);
        },
        error: err => console.error('Failed to update schedule', err.error.errors)
      });

    } else {
      const createDto: CreateScheduleDto = {
        routeId: Number(this.selectedRouteCode),
        vehicleId: Number(this.selectedVehicleCode),
        departureDateTime: this.wrapTimeToISO(this.selectedSchedule.departureDateTime),
        arrivalDateTime: this.wrapTimeToISO(this.selectedSchedule.arrivalDateTime),
        baseFare: this.selectedSchedule.baseFare,
        status: this.selectedSchedule.status || 'Scheduled'
      };

      this.scheduleService.createSchedule(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Schedule created successfully!';
          this.loadSchedules();
          this.reset();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to create schedule', err.error.errors)
      });
    }
  }

  // Delete confirmation
  confirmDelete(schedule: ScheduleDto): void {
    this.scheduleToDelete = schedule;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.scheduleToDelete = null;
    this.showDeleteConfirmModal = false;
  }

  deleteConfirmed(): void {
    if (!this.scheduleToDelete) return;

    this.scheduleService.deleteSchedule(this.scheduleToDelete.id).subscribe({
      next: () => {
        this.loadSchedules();
        this.showDeleteConfirmModal = false;
        this.scheduleToDelete = null;
        this.successMessage = '🗑️ Schedule deleted successfully!';
        this.autoClearMessage();
      },
      error: err => console.error('Failed to delete schedule', err)
    });
  }

  // Reset
  reset(): void {
    this.selectedSchedule = this.getEmptySchedule();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
  }

  getRouteName(routeId: number): string {
    const route = this.routes.find(r => r.id === routeId);
    return route ? route.routeName : '';
  }

  getVehicleModel(vehicleId: number): string {
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    return vehicle ? vehicle.model : '';
  }

  getEmptySchedule(): ScheduleDto {
    return {
      id: 0,
      routeId: 0,
      vehicleId: 0,
      departureDateTime: '',
      arrivalDateTime: '',
      baseFare: 0,
      status: 'Scheduled',
      scheduleCode: '',
      createdAt: '',
      createdBy: '',
      lastModifiedAt: '',
      lastModifiedBy: '',
      routeName: '',
      vehicleName: ''
    };
  }

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
  }

  // Sorting
  sortBy(field: keyof ScheduleDto): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.schedules.sort((a, b) => {
      const valA = a[field]?.toString().toLowerCase() ?? '';
      const valB = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }

  calculateArrivalTime(): void {
    if (!this.selectedSchedule.departureDateTime || !this.selectedRouteCode) return;

    const route = this.routes.find(r => r.id === Number(this.selectedRouteCode));
    if (!route || !route.estimatedDurationHours) return;

    // Parse departure time (HH:mm)
    const [depHour, depMinute] = this.selectedSchedule.departureDateTime.split(':').map(Number);
    let totalMinutes = depHour * 60 + depMinute + route.estimatedDurationHours * 60;

    // Wrap around 24 hours
    totalMinutes = totalMinutes % (24 * 60);

    const arrHour = Math.floor(totalMinutes / 60);
    const arrMinute = totalMinutes % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.selectedSchedule.arrivalDateTime = `${pad(arrHour)}:${pad(arrMinute)}`;
  }
}