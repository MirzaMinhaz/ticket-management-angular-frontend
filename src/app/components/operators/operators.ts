import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OperatorService } from '../../services/operators.service';
import { OperatorDto, CreateOperatorDto, UpdateOperatorDto } from '../../models/common';
import { Subject, Observable, of } from 'rxjs';
import { exhaustMap, catchError, finalize, tap } from 'rxjs/operators';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
  leaving?: boolean;
}

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './operators.html',
  styleUrls: ['./operators.css']
})
export class OperatorComponent implements OnInit, OnDestroy {
  operatorForm!: FormGroup;
  editForm!: FormGroup;

  operators: OperatorDto[] = [];
  loading = false;

  showEditModal = false;
  selectedOperatorId: number | null = null;

  operatorToDelete: OperatorDto | null = null;
  showDeleteConfirmModal = false;

  currentPage = 1;
  itemsPerPage = 30;
  sortField: string = '';
  sortAsc = true;

  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;
  private readonly TOAST_DURATION_MS = 3000;

  // Create/update requests flow through here; exhaustMap drops new
  // emissions while a save is already in flight (prevents double submit).
  private saveTrigger$ = new Subject<'create' | 'update'>();

  constructor(
    private fb: FormBuilder,
    private operatorService: OperatorService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.operatorForm = this.fb.group({
      name: ['', Validators.required],
      type: ['', Validators.required]
    });

    this.editForm = this.fb.group({
      name: ['', Validators.required],
      type: ['', Validators.required]
    });

    this.loadOperators();
    this.setupSaveStream();
  }

  ngOnDestroy(): void {
    this.saveTrigger$.complete();
  }

  // -------------------------------------------------------------------
  // Toast notifications
  // -------------------------------------------------------------------
  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast: ToastMessage = { id: ++this.toastIdCounter, message, type };
    this.toasts = [...this.toasts, toast];
    setTimeout(() => this.dismissToast(toast.id), this.TOAST_DURATION_MS);
  }

  dismissToast(id: number): void {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast || toast.leaving) return;

    toast.leaving = true;
    setTimeout(() => {
      this.ngZone.run(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      });
    }, 200);
  }

  // -------------------------------------------------------------------
  // exhaustMap save pipeline
  // -------------------------------------------------------------------
  private setupSaveStream(): void {
    this.saveTrigger$
      .pipe(
        exhaustMap(mode => {
          this.ngZone.run(() => (this.loading = true));

          return this.performSave(mode).pipe(
            catchError(err => {
              console.error(`${mode} operator failed`, err);
              this.ngZone.run(() => {
                const message =
                  typeof err.error === 'string'
                    ? err.error
                    : err.error?.message || `Failed to ${mode === 'create' ? 'create' : 'update'} operator.`;
                this.showToast(message, 'error');
              });
              return of(null);
            }),
            finalize(() => {
              this.ngZone.run(() => (this.loading = false));
            })
          );
        })
      )
      .subscribe();
  }

  private performSave(mode: 'create' | 'update'): Observable<any> {
    if (mode === 'update' && this.selectedOperatorId !== null) {
      const updatePayload: UpdateOperatorDto = {
        name: this.editForm.value.name,
        type: this.editForm.value.type
      };

      return this.operatorService.update(this.selectedOperatorId, updatePayload).pipe(
        tap(() => {
          this.ngZone.run(() => {
            this.loadOperators();
            this.closeModal();
            this.showToast('Operator updated successfully.', 'success');
          });
        })
      );
    }

    const createPayload: CreateOperatorDto = {
      name: this.operatorForm.value.name,
      type: this.operatorForm.value.type
    };

    return this.operatorService.create(createPayload).pipe(
      tap(() => {
        this.ngZone.run(() => {
          this.loadOperators();
          this.operatorForm.reset();
          this.showToast('Operator created successfully.', 'success');
        });
      })
    );
  }

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------
  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: (data: OperatorDto[]) => (this.operators = data),
      error: (err: any) => {
        console.error('Failed to load operators', err);
        this.showToast('Failed to load operators.', 'error');
      }
    });
  }

  // -------------------------------------------------------------------
  // Pagination & sorting
  // -------------------------------------------------------------------
  get paginatedOperators(): OperatorDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.operators.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.operators.length / this.itemsPerPage);
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

  sortBy(field: keyof OperatorDto): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.operators = [...this.operators].sort((a, b) => {
      const valA = (a[field] ?? '').toString().toLowerCase();
      const valB = (b[field] ?? '').toString().toLowerCase();
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }

  // -------------------------------------------------------------------
  // Form helpers
  // -------------------------------------------------------------------
  isInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    if (this.operatorForm.invalid || this.loading) return;
    this.saveTrigger$.next('create');
  }

  // -------------------------------------------------------------------
  // Edit modal
  // -------------------------------------------------------------------
  openEditModal(op: OperatorDto): void {
    this.selectedOperatorId = op.id;
    this.editForm.setValue({
      name: op.name,
      type: op.type
    });
    this.showEditModal = true;
  }

  onEditSubmit(): void {
    if (this.editForm.invalid || this.selectedOperatorId === null || this.loading) return;
    this.saveTrigger$.next('update');
  }

  closeModal(): void {
    this.showEditModal = false;
    this.editForm.reset();
    this.selectedOperatorId = null;
  }

  // -------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------
  confirmDelete(op: OperatorDto): void {
    this.operatorToDelete = op;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.operatorToDelete = null;
    this.showDeleteConfirmModal = false;
  }

  deleteConfirmed(): void {
    if (!this.operatorToDelete) return;

    this.operatorService.delete(this.operatorToDelete.id).subscribe({
      next: () => {
        this.loadOperators();
        this.showDeleteConfirmModal = false;
        this.operatorToDelete = null;
        this.showToast('Operator deleted successfully.', 'success');
      },
      error: (err: any) => {
        console.error('Failed to delete operator', err);
        this.showToast('Failed to delete operator. Please try again.', 'error');
      }
    });
  }
}