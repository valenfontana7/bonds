import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import {
  CATEGORY_LABELS,
  PersonCategory,
} from '../../core/models/person.model';

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="form-page">
      <header>
        <a routerLink="/personas" class="back-link">← Volver</a>
        <h1>{{ isEdit ? 'Editar persona' : 'Agregar persona' }}</h1>
      </header>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="photo-upload">
          @if (photoPreview) {
            <img [src]="photoPreview" alt="Vista previa" class="preview" />
          } @else {
            <div class="preview placeholder">📷</div>
          }
          <label class="btn-secondary">
            Elegir foto
            <input type="file" accept="image/*" (change)="onPhotoSelected($event)" hidden />
          </label>
        </div>

        <label>
          Nombre
          <input formControlName="name" placeholder="Ej: Mamá" />
        </label>

        <label>
          Categoría
          <select formControlName="category">
            @for (cat of categories; track cat.value) {
              <option [value]="cat.value">{{ cat.label }}</option>
            }
          </select>
        </label>

        <label>
          Frecuencia deseada (días)
          <input type="number" formControlName="desiredFrequencyDays" min="1" max="365" />
          <span class="hint">Cada cuántos días te gustaría conectar</span>
        </label>

        <div class="actions">
          <button type="submit" class="btn-primary" [disabled]="form.invalid">
            {{ isEdit ? 'Guardar cambios' : 'Agregar persona' }}
          </button>
          @if (isEdit) {
            <button type="button" class="btn-danger" (click)="onDelete()">Eliminar</button>
          }
        </div>
      </form>
    </section>
  `,
  styles: `
    .form-page {
      max-width: 480px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 1.5rem;

      h1 {
        margin: 0.5rem 0 0;
        font-size: 1.5rem;
      }
    }

    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;

      &:hover { color: var(--text); }
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    input, select {
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: #6366f1;
      }
    }

    .hint {
      font-weight: 400;
      font-size: 0.78rem;
    }

    .photo-upload {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .preview {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--border);

      &.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        background: var(--surface);
      }
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
  `,
})
export class PersonFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bonds = inject(BondsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  isEdit = false;
  personId?: string;
  photoPreview?: string;

  readonly categories = (
    Object.entries(CATEGORY_LABELS) as [PersonCategory, string][]
  ).map(([value, label]) => ({ value, label }));

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['familia' as PersonCategory, Validators.required],
    desiredFrequencyDays: [14, [Validators.required, Validators.min(1), Validators.max(365)]],
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'nueva') {
      this.isEdit = true;
      this.personId = id;
      const person = this.bonds.getPerson(id);
      if (person) {
        this.form.patchValue({
          name: person.name,
          category: person.category,
          desiredFrequencyDays: person.desiredFrequencyDays,
        });
        this.photoPreview = person.photo;
      }
    }
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();

    if (this.isEdit && this.personId) {
      this.bonds.updatePerson(this.personId, {
        ...value,
        photo: this.photoPreview,
      });
      this.router.navigate(['/personas', this.personId]);
    } else {
      const person = this.bonds.addPerson({
        ...value,
        photo: this.photoPreview,
      });
      this.router.navigate(['/personas', person.id]);
    }
  }

  onDelete(): void {
    if (this.personId && confirm('¿Eliminar a esta persona de tu red?')) {
      this.bonds.deletePerson(this.personId);
      this.router.navigate(['/personas']);
    }
  }
}
