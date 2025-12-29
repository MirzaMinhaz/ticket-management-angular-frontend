// src/app/features/ticket/ticket.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { TicketService } from '../../services/ticket.service';
import { Ticket } from '../../models/common';

@Component({
  selector: 'app-ticket',
  standalone: true, // <-- standalone component
  imports: [
    CommonModule,        // gives *ngFor, *ngIf, date pipe, number pipe
    FormsModule,         // template-driven forms if needed
    ReactiveFormsModule  // reactive forms (formGroup, formControlName)
  ],
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.css']
})
export class TicketComponent implements OnInit {
  tickets: Ticket[] = [];
  loading = false;
  saving = false;
  editingId: number | null = null;

  statusOptions = ['Booked', 'Cancelled', 'Completed', 'Pending'];

  // In real UI, these IDs should be loaded via services and shown as dropdowns
  scheduleOptions: { id: number; code: string }[] = [];
  counterOptions: { id: number; name: string }[] = [];
  userOptions: { id: number; name: string }[] = [];

  form!: FormGroup;
  filterForm!: FormGroup;

  constructor(private fb: FormBuilder, private ticketService: TicketService) {}

  ngOnInit(): void {
    // Initialize reactive forms
    this.form = this.fb.group({
      id: [null],
      userId: [null, [Validators.required]],
      scheduleId: [null, [Validators.required]],
      seatCode: [null],
      seatNumber: [null],
      bookingCounterId: [null, [Validators.required]],
      departureCounterId: [null, [Validators.required]],
      arrivalCounterId: [null, [Validators.required]],
      ticketCode: ['', [Validators.required, Validators.maxLength(32)]],
      passengerName: ['', [Validators.required, Validators.maxLength(100)]],
      passengerContact: ['', [Validators.required, Validators.maxLength(30)]],
      farePaid: [0, [Validators.required, Validators.min(0)]],
      bookingDateTime: ['', [Validators.required]],
      status: ['Booked', [Validators.required]]
    });

    this.filterForm = this.fb.group({
      status: [''],
      scheduleId: [null],
      passengerName: ['']
    });

    // Placeholder: load ref data via your services
    this.scheduleOptions = [
      { id: 1, code: 'SCH-001' },
      { id: 2, code: 'SCH-002' }
    ];
    this.counterOptions = [
      { id: 10, name: 'Gabtoli' },
      { id: 20, name: 'Mohakhali' },
      { id: 30, name: 'Sayedabad' }
    ];
    this.userOptions = [
      { id: 100, name: 'Agent-100' },
      { id: 101, name: 'Agent-101' }
    ];

    this.loadTickets();
  }

  loadTickets(): void {
    this.loading = true;
    const filter = this.filterForm.value;
    this.ticketService
      .getTickets(filter)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => (this.tickets = data),
        error: (err) => console.error('Failed to load tickets', err)
      });
  }

  resetForm(): void {
    this.form.reset({
      id: null,
      userId: null,
      scheduleId: null,
      seatCode: null,
      seatNumber: null,
      bookingCounterId: null,
      departureCounterId: null,
      arrivalCounterId: null,
      ticketCode: '',
      passengerName: '',
      passengerContact: '',
      farePaid: 0,
      bookingDateTime: '',
      status: 'Booked'
    });
    this.editingId = null;
  }

  edit(ticket: Ticket): void {
    this.form.patchValue({
      id: ticket.id,
      userId: ticket.userId,
      scheduleId: ticket.scheduleId,
      seatCode: ticket.seatCode,
      seatNumber: ticket.seatNumber,
      bookingCounterId: ticket.bookingCounterId,
      departureCounterId: ticket.departureCounterId,
      arrivalCounterId: ticket.arrivalCounterId,
      ticketCode: ticket.ticketCode,
      passengerName: ticket.passengerName,
      passengerContact: ticket.passengerContact,
      farePaid: ticket.farePaid,
      bookingDateTime: ticket.bookingDateTime?.slice(0, 16), // for datetime-local
      status: ticket.status
    });
    this.editingId = ticket.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  delete(ticket: Ticket): void {
    if (!confirm(`Delete ticket ${ticket.ticketCode}?`)) return;
    this.ticketService.deleteTicket(ticket.id).subscribe({
      next: () => this.loadTickets(),
      error: (err) => console.error('Delete failed', err)
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value;
    const payload = {
      userId: Number(value.userId),
      scheduleId: Number(value.scheduleId),
      seatCode: value.seatCode ?? null,
      seatNumber: value.seatNumber ?? null,
      bookingCounterId: Number(value.bookingCounterId),
      departureCounterId: Number(value.departureCounterId),
      arrivalCounterId: Number(value.arrivalCounterId),
      ticketCode: value.ticketCode,
      passengerName: value.passengerName,
      passengerContact: value.passengerContact,
      farePaid: Number(value.farePaid),
      bookingDateTime: this.toIso(value.bookingDateTime),
      status: value.status
    };

    this.saving = true;

    if (this.editingId) {
      this.ticketService
        .updateTicket({ id: this.editingId, ...payload })
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.resetForm();
            this.loadTickets();
          },
          error: (err) => console.error('Update failed', err)
        });
    } else {
      this.ticketService
        .createTicket(payload)
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.resetForm();
            this.loadTickets();
          },
          error: (err) => console.error('Create failed', err)
        });
    }
  }

  private toIso(dtLocal: string): string {
    // dtLocal from input[type=datetime-local] => 'YYYY-MM-DDTHH:mm'
    if (!dtLocal) return new Date().toISOString();
    const withSeconds = dtLocal.length === 16 ? `${dtLocal}:00` : dtLocal;
    return withSeconds;
  }
}
