import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-person-avatar',
  standalone: true,
  template: `
    @if (photo) {
      <img [src]="photo" [alt]="name" class="avatar" [style.width.px]="size" [style.height.px]="size" />
    } @else {
      <div class="avatar fallback" [style.width.px]="size" [style.height.px]="size">
        {{ initials }}
      </div>
    }
  `,
  styles: `
    .avatar {
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    }

    .fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-weight: 600;
      font-size: 0.85em;
    }
  `,
})
export class PersonAvatarComponent {
  @Input({ required: true }) name!: string;
  @Input() photo?: string;
  @Input() size = 48;

  get initials(): string {
    return this.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
