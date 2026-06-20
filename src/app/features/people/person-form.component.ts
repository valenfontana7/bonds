import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BondsService } from '../../core/services/bonds.service';
import {
  CATEGORY_LABELS,
  PREFERRED_CONTACT_LABELS,
  PersonCategory,
  PreferredContact,
  birthdayToDateInput,
  dateInputToBirthday,
} from '../../core/models/person.model';

const MAX_PHOTO_BYTES = 500_000;

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <section class="form-page">
      @if (notFound) {
        <div class="not-found">
          <h1>Persona no encontrada</h1>
          <p>No pudimos cargar esta persona para editar.</p>
          <a routerLink="/personas" class="btn-primary">Volver a personas</a>
        </div>
      } @else {
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
            @if (photoError()) {
              <p class="field-error">{{ photoError() }}</p>
            }
          </div>

          <label>
            Nombre
            <input formControlName="name" placeholder="Ej: Mamá" autocomplete="name" />
            @if (showError('name')) {
              <span class="field-error">{{ fieldError('name') }}</span>
            }
            @if (duplicateName(); as existing) {
              <span class="field-warn">Ya tenés a «{{ existing }}» en tu red.</span>
            }
          </label>

          <label>
            Categoría
            <div class="category-presets" role="group" aria-label="Elegir categoría">
              @for (cat of categories; track cat.value) {
                <button
                  type="button"
                  class="preset-chip"
                  [class.active]="form.controls.category.value === cat.value"
                  (click)="form.controls.category.setValue(cat.value)"
                >
                  {{ cat.label }}
                </button>
              }
            </div>
            <select formControlName="category">
              @for (cat of categories; track cat.value) {
                <option [value]="cat.value">{{ cat.label }}</option>
              }
            </select>
          </label>

          <label>
            Prefiere contactarse por
            <select [(ngModel)]="preferredContactInput" [ngModelOptions]="{ standalone: true }">
              <option value="">Sin preferencia</option>
              @for (option of preferredContactOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <span class="hint">Opcional — te ayuda a elegir cómo reconectar</span>
          </label>

          <label>
            Frecuencia deseada (días)
            <div class="freq-presets" role="group" aria-label="Atajos de frecuencia">
              @for (preset of frequencyPresets; track preset.days) {
                <button
                  type="button"
                  class="preset-chip"
                  [class.active]="form.controls.desiredFrequencyDays.value === preset.days"
                  (click)="setFrequency(preset.days)"
                >
                  {{ preset.label }}
                </button>
              }
            </div>
            <input type="number" formControlName="desiredFrequencyDays" min="1" max="365" />
            <span class="hint">Cada cuántos días te gustaría conectar</span>
            @if (showError('desiredFrequencyDays')) {
              <span class="field-error">{{ fieldError('desiredFrequencyDays') }}</span>
            }
          </label>

          <label>
            Cumpleaños
            <input type="date" [(ngModel)]="birthdayInput" [ngModelOptions]="{ standalone: true }" />
            <span class="hint">Opcional — solo día y mes, sin año</span>
          </label>

          <label>
            Nota fija
            <textarea
              [(ngModel)]="pinnedNoteInput"
              [ngModelOptions]="{ standalone: true }"
              rows="3"
              maxlength="300"
              placeholder="Ej: Le gusta el fútbol, evitar hablar de política, prefiere WhatsApp…"
            ></textarea>
            <span class="hint">Opcional — visible en el perfil y la lista de personas</span>
          </label>

          <label>
            Teléfono
            <input
              [(ngModel)]="phoneInput"
              [ngModelOptions]="{ standalone: true }"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="Ej: +54 9 11 1234-5678"
            />
            <span class="hint">Opcional — para llamar o abrir WhatsApp desde el perfil</span>
          </label>

          <label>
            Email
            <input
              [(ngModel)]="emailInput"
              [ngModelOptions]="{ standalone: true }"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="Ej: nombre@email.com"
            />
            <span class="hint">Opcional</span>
          </label>

          <div class="actions">
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{
                saving()
                  ? 'Guardando…'
                  : isEdit
                    ? 'Guardar cambios'
                    : 'Agregar persona'
              }}
            </button>
            @if (isEdit) {
              <button type="button" class="btn-danger" [disabled]="saving()" (click)="showDeleteConfirm.set(true)">
                Eliminar
              </button>
            }
          </div>
        </form>

        @if (showDeleteConfirm()) {
          <div class="confirm-backdrop" role="presentation" (click)="showDeleteConfirm.set(false)"></div>
          <div class="confirm-dialog" role="alertdialog" aria-labelledby="delete-title">
            <h2 id="delete-title">¿Eliminar a {{ form.controls.name.value }}?</h2>
            <p>Se borra de tu red y su historial de interacciones. No se puede deshacer.</p>
            <div class="confirm-actions">
              <button type="button" class="btn-secondary" (click)="showDeleteConfirm.set(false)">Cancelar</button>
              <button type="button" class="btn-danger" [disabled]="saving()" (click)="confirmDelete()">
                Sí, eliminar
              </button>
            </div>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .form-page {
      max-width: 480px;
      margin: 0 auto;
      position: relative;
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
        border-color: var(--accent);
      }
    }

    textarea {
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 0.95rem;
      font-family: inherit;
      resize: vertical;
      min-height: 4rem;

      &:focus {
        outline: none;
        border-color: var(--accent);
      }
    }

    input.ng-invalid.ng-touched,
    select.ng-invalid.ng-touched {
      border-color: color-mix(in srgb, var(--sync-error-text) 55%, transparent);
    }

    .hint {
      font-weight: 400;
      font-size: 0.78rem;
    }

    .freq-presets,
    .category-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.15rem;
    }

    .preset-chip {
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-muted);
      font-size: 0.75rem;
      cursor: pointer;

      &.active {
        border-color: rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.12);
        color: var(--accent-soft);
      }
    }

    .field-error {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 400;
      color: var(--sync-error-text);
    }

    .field-warn {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 400;
      color: var(--warning);
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

    .not-found {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;

      h1 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text);
      }

      p { margin: 0; }
    }

    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 300;
    }

    .confirm-dialog {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: calc(100% - 2rem);
      max-width: 360px;
      padding: 1.25rem;
      border-radius: 1rem;
      border: 1px solid var(--border);
      background: var(--surface);
      z-index: 301;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      p {
        margin: 0;
        font-size: 0.88rem;
        color: var(--text-muted);
        line-height: 1.45;
      }
    }

    .confirm-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;

      button { flex: 1; }
    }
  `,
})
export class PersonFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bonds = inject(BondsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  isEdit = false;
  notFound = false;
  personId?: string;
  photoPreview?: string;
  birthdayInput = '';
  pinnedNoteInput = '';
  phoneInput = '';
  emailInput = '';
  preferredContactInput = '';
  submitted = false;

  readonly saving = signal(false);
  readonly photoError = signal('');
  readonly showDeleteConfirm = signal(false);

  readonly duplicateName = computed(() => {
    const name = this.form.controls.name.value.trim().toLowerCase();
    if (name.length < 2) return null;
    const match = this.bonds.people().find(
      (person) =>
        person.name.trim().toLowerCase() === name && person.id !== this.personId,
    );
    return match?.name ?? null;
  });

  readonly categories = (
    Object.entries(CATEGORY_LABELS) as [PersonCategory, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly preferredContactOptions = (
    Object.entries(PREFERRED_CONTACT_LABELS) as [PreferredContact, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly frequencyPresets = [
    { days: 7, label: 'Semanal' },
    { days: 14, label: 'Quincenal' },
    { days: 30, label: 'Mensual' },
    { days: 90, label: 'Trimestral' },
  ];

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
        this.birthdayInput = birthdayToDateInput(person.birthday);
        this.pinnedNoteInput = person.pinnedNote ?? '';
        this.phoneInput = person.phone ?? '';
        this.emailInput = person.email ?? '';
        this.preferredContactInput = person.preferredContact ?? '';
      } else {
        this.notFound = true;
      }
    }
  }

  showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.touched || this.submitted));
  }

  setFrequency(days: number): void {
    this.form.controls.desiredFrequencyDays.setValue(days);
    this.form.controls.desiredFrequencyDays.markAsDirty();
  }

  fieldError(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['minlength']) return 'Mínimo 2 caracteres.';
    if (control.errors['min']) return 'Mínimo 1 día.';
    if (control.errors['max']) return 'Máximo 365 días.';
    return 'Valor inválido.';
  }

  onPhotoSelected(event: Event): void {
    this.photoError.set('');
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.photoError.set('Elegí un archivo de imagen (JPG, PNG, etc.).');
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('La foto debe pesar menos de 500 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const value = this.form.getRawValue();
    const birthday = dateInputToBirthday(this.birthdayInput);
    const pinnedNote = this.pinnedNoteInput.trim() || undefined;
    const phone = this.phoneInput.trim() || undefined;
    const email = this.emailInput.trim() || undefined;
    const preferredContact = (this.preferredContactInput || undefined) as PreferredContact | undefined;

    if (this.isEdit && this.personId) {
      this.bonds.updatePerson(this.personId, {
        ...value,
        photo: this.photoPreview,
        birthday,
        pinnedNote,
        phone,
        email,
        preferredContact,
      });
      void this.router.navigate(['/personas', this.personId]);
      return;
    }

    const person = this.bonds.addPerson({
      ...value,
      photo: this.photoPreview,
      birthday,
      pinnedNote,
      phone,
      email,
      preferredContact,
    });
    if (this.bonds.people().length === 1) {
      void this.router.navigate(['/']);
    } else {
      void this.router.navigate(['/personas', person.id]);
    }
  }

  confirmDelete(): void {
    if (!this.personId || this.saving()) return;
    this.saving.set(true);
    this.bonds.deletePerson(this.personId);
    void this.router.navigate(['/personas']);
  }
}
