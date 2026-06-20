import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { GraphComponent } from './features/graph/graph.component';
import { OnboardingComponent } from './features/onboarding/onboarding.component';
import { PeopleListComponent } from './features/people/people-list.component';
import { PersonDetailComponent } from './features/people/person-detail.component';
import { PersonFormComponent } from './features/people/person-form.component';
import { WeekConnectionsComponent } from './features/week/week-connections.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AuthService } from './core/services/auth.service';
import { BondsService } from './core/services/bonds.service';

const welcomeGuard = () => {
  const bonds = inject(BondsService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (bonds.isOnboardingComplete() && auth.isLoggedIn()) {
    return router.createUrlTree(['/']);
  }
  return true;
};

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/bienvenida']);
  }
  return true;
};

const appGuard = () => {
  const bonds = inject(BondsService);
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/bienvenida']);
  }
  if (!bonds.isOnboardingComplete()) {
    return router.createUrlTree(['/bienvenida']);
  }
  return true;
};

export const routes: Routes = [
  { path: 'bienvenida', component: OnboardingComponent, canActivate: [welcomeGuard] },
  { path: 'personas/nueva', component: PersonFormComponent, canActivate: [authGuard] },
  { path: '', component: GraphComponent, canActivate: [appGuard] },
  { path: 'personas', component: PeopleListComponent, canActivate: [appGuard] },
  { path: 'personas/:id/editar', component: PersonFormComponent, canActivate: [appGuard] },
  { path: 'personas/:id', component: PersonDetailComponent, canActivate: [appGuard] },
  { path: 'semana', component: WeekConnectionsComponent, canActivate: [appGuard] },
  { path: 'ajustes', component: SettingsComponent, canActivate: [appGuard] },
  { path: '**', redirectTo: '' },
];
