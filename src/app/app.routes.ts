import { Routes } from '@angular/router';
import { GraphComponent } from './features/graph/graph.component';
import { PeopleListComponent } from './features/people/people-list.component';
import { PersonDetailComponent } from './features/people/person-detail.component';
import { PersonFormComponent } from './features/people/person-form.component';
import { WeekConnectionsComponent } from './features/week/week-connections.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', component: GraphComponent },
  { path: 'personas', component: PeopleListComponent },
  { path: 'personas/nueva', component: PersonFormComponent },
  { path: 'personas/:id/editar', component: PersonFormComponent },
  { path: 'personas/:id', component: PersonDetailComponent },
  { path: 'semana', component: WeekConnectionsComponent },
  { path: 'ajustes', component: SettingsComponent },
  { path: '**', redirectTo: '' },
];
