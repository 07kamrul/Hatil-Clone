import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/public-layout').then((m) => m.PublicLayout),
    children: [
      { path: '', pathMatch: 'full', title: 'Home', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
      { path: 'products', loadComponent: () => import('./features/catalog/listing').then((m) => m.Listing), data: { mode: 'all' } },
      { path: 'category/:slug', loadComponent: () => import('./features/catalog/listing').then((m) => m.Listing), data: { mode: 'category' } },
      { path: 'search', loadComponent: () => import('./features/catalog/listing').then((m) => m.Listing), data: { mode: 'search' } },
      { path: 'product/:slug', loadComponent: () => import('./features/product/product-page').then((m) => m.ProductPage) },
      { path: 'cart', loadComponent: () => import('./features/cart/cart-page').then((m) => m.CartPage) },
      { path: 'wishlist', loadComponent: () => import('./features/lists/wishlist-page').then((m) => m.WishlistPage) },
      { path: 'compare', loadComponent: () => import('./features/lists/compare-page').then((m) => m.ComparePage) },
      { path: 'showrooms', loadComponent: () => import('./features/showrooms/showrooms-page').then((m) => m.ShowroomsPage) },
      { path: 'showrooms/:slug', loadComponent: () => import('./features/showrooms/showroom-detail').then((m) => m.ShowroomDetail) },
      { path: 'blog', loadComponent: () => import('./features/blog/blog-list').then((m) => m.BlogList) },
      { path: 'blog/:slug', loadComponent: () => import('./features/blog/blog-detail').then((m) => m.BlogDetail) },
      { path: 'contact', loadComponent: () => import('./features/contact/contact-page').then((m) => m.ContactPage) },
      { path: 'faq', loadComponent: () => import('./features/pages/faq-page').then((m) => m.FaqPage) },
      { path: 'page/:slug', loadComponent: () => import('./features/pages/cms-page').then((m) => m.CmsPageView) },
      { path: '**', loadComponent: () => import('./features/pages/not-found').then((m) => m.NotFound) },
    ],
  },
];
