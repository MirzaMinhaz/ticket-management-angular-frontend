import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OperatorService } from '../../services/operators.service';
import { OperatorDto, CreateOperatorDto, UpdateOperatorDto } from '../../models/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './operators.html',
  styleUrls: ['./operators.css']
})
export class OperatorComponent implements OnInit {
  operatorForm!: FormGroup;
  editForm!: FormGroup;
  operators: OperatorDto[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  showEditModal = false;
  selectedOperatorId: number | null = null;

  constructor(private fb: FormBuilder, private operatorService: OperatorService) { }

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
  }

  loadOperators(): void {
    this.loading = true;
    this.operatorService.getAll().subscribe({
      next: (data: OperatorDto[]) => {
        this.operators = data;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Load error:', err);
        this.errorMessage = 'Failed to load operators.';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.operatorForm.invalid) return;

    const createPayload: CreateOperatorDto = {
      name: this.operatorForm.value.name,
      type: this.operatorForm.value.type
    };

    this.loading = true;
    this.operatorService.create(createPayload).subscribe({
      next: () => {
        this.successMessage = 'Operator created successfully!';
        this.operatorForm.reset();
        this.loadOperators();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Create error:', err);
        this.errorMessage = 'Failed to create operator.';
        this.loading = false;
      }
    });
  }

  openEditModal(op: OperatorDto): void {
    this.selectedOperatorId = op.id;
    this.editForm.setValue({
      name: op.name,
      type: op.type
    });
    this.showEditModal = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  onEditSubmit(): void {
    if (this.editForm.invalid || this.selectedOperatorId === null) return;

    const updatePayload: UpdateOperatorDto = {
      name: this.editForm.value.name,
      type: this.editForm.value.type
    };

    this.loading = true;
    this.operatorService.update(this.selectedOperatorId, updatePayload).subscribe({
      next: () => {
        this.successMessage = 'Operator updated successfully!';
        this.loadOperators();
        this.loading = false;

        setTimeout(() => {
          this.closeModal();
        }, 1500); // Auto-close after success
      },
      error: (err: any) => {
        console.error('Update error:', err);
        this.errorMessage = 'Failed to update operator.';
        this.loading = false;
      }
    });
  }

  closeModal(): void {
    this.showEditModal = false;
    this.editForm.reset();
    this.selectedOperatorId = null;
    this.successMessage = '';
    this.errorMessage = '';
  }

  delete(id: number): void {
    if (!confirm('Are you sure you want to delete this operator?')) return;

    this.loading = true;
    this.operatorService.delete(id).subscribe({
      next: () => {
        this.loadOperators();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Delete error:', err);
        this.errorMessage = 'Failed to delete operator.';
        this.loading = false;
      }
    });
  }
}
