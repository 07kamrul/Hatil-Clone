import { Routes } from '@angular/router';

import { adminGuard, superAdminGuard } from './core/admin-guard';

const resource = (key: string): Routes => [
  { path: key, data: { resource: key }, loadComponent: () => import('./resources/resource-list').then((m) => m.ResourceList) },
  { path: `${key}/:id`, data: { resource: key }, loadComponent: () => import('./resources/resource-form').then((m) => m.ResourceForm) },
];

export const adminRoutes: Routes = [
  { path: 'login', title: 'Admin sign in', loadComponent: () => import('./pages/login').then((m) => m.AdminLogin) },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', title: 'Dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.AdminDashboard) },
      { path: 'products', loadComponent: () => import('./pages/products-list').then((m) => m.AdminProducts) },
      { path: 'products/:id', loadComponent: () => import('./pages/product-form').then((m) => m.AdminProductForm) },
      { path: 'categories', loadComponent: () => import('./pages/categories').then((m) => m.AdminCategories) },
      ...['colors', 'materials', 'rooms', 'banners', 'showrooms', 'blog', 'pages', 'faqs'].flatMap(resource),
      { path: 'inquiries', loadComponent: () => import('./pages/inbox').then((m) => m.AdminInquiries) },
      { path: 'messages', loadComponent: () => import('./pages/inbox').then((m) => m.AdminMessages) },
      { path: 'settings', loadComponent: () => import('./pages/settings').then((m) => m.AdminSettings) },
      { path: 'users', canActivate: [superAdminGuard], loadComponent: () => import('./pages/users').then((m) => m.AdminUsers) },
      { path: 'account', loadComponent: () => import('./pages/users').then((m) => m.AdminAccount) },
    ],
  },
];
