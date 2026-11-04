export type StockStatus = 'in_stock' | 'out_of_stock' | 'pre_order' | 'made_to_order';
export type SortKey = 'new' | 'price_asc' | 'price_desc' | 'popular' | 'name';

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  pre_order: 'Pre-order',
  made_to_order: 'Made to order',
};

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CategoryRef { id: number; name: string; slug: string }
export interface Color { id: number; name: string; slug: string; hex_code: string | null }
export interface Material { id: number; name: string; slug: string }
export interface Room { id: number; name: string; slug: string; image: string | null; sort_order: number }

export interface ProductCard {
  id: number;
  slug: string;
  sku: string;
  name: string;
  price: number;
  sale_price: number | null;
  final_price: number;
  discount_percent: number;
  stock_status: StockStatus;
  image: string | null;
  image_hover: string | null;
  category: CategoryRef | null;
  colors: Color[];
  is_featured: boolean;
  is_best_seller: boolean;
  is_published: boolean;
  view_count: number;
  created_at: string;
}

export interface ProductImage { id: number; url: string; thumb_url: string | null; alt: string | null; sort_order: number; is_dimension: boolean }
export interface ProductVariant { id: number; color: Color | null; size: string | null; sku: string | null; price_delta: number; stock_status: StockStatus }
export interface ProductSpec { key: string; value: string }

export interface ProductDetail extends ProductCard {
  short_desc: string | null;
  description_html: string | null;
  dimensions: string | null;
  warranty: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  specs: ProductSpec[];
  materials: Material[];
  rooms: Room[];
  breadcrumbs: CategoryRef[];
  updated_at: string;
}

export interface FacetOption { slug: string; name: string; count: number; hex_code: string | null }
export interface ProductFacets {
  colors: FacetOption[];
  materials: FacetOption[];
  rooms: FacetOption[];
  availability: FacetOption[];
  min_price: number;
  max_price: number;
}

export interface ProductQuery {
  q?: string;
  category?: string;
  min_price?: number | null;
  max_price?: number | null;
  colors?: string[];
  materials?: string[];
  rooms?: string[];
  availability?: string[];
  featured?: boolean;
  best_seller?: boolean;
  on_sale?: boolean;
  sort?: SortKey;
  page?: number;
  page_size?: number;
}

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  product_count: number;
  children: CategoryNode[];
}

export interface CategoryDetail {
  id: number;
  name: string;
  slug: string;
  description_html: string | null;
  image: string | null;
  banner_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  breadcrumbs: CategoryRef[];
  children: CategoryRef[];
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image: string;
  mobile_image: string | null;
  link_url: string | null;
  button_text: string | null;
  placement: 'hero' | 'offer' | 'promo';
  sort_order: number;
  is_active: boolean;
}

export interface Showroom {
  id: number;
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  off_days: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
}

export interface BlogSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string | null;
  tags: string | null;
  published_at: string | null;
}
export interface BlogPost extends BlogSummary { body_html: string; gallery: string[]; seo_title: string | null; seo_description: string | null }

export interface CmsPage { id: number; title: string; slug: string; body_html: string; seo_title: string | null; seo_description: string | null }
export interface Faq { id: number; question: string; answer_html: string; group: string; show_on_home: boolean }
export interface Suggestion { type: 'product' | 'category'; name: string; slug: string; image: string | null; price: number | null }

export interface SiteSettings {
  site_name: string;
  tagline: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  whatsapp_number: string;
  hotline: string;
  contact_email: string;
  address: string;
  map_lat: number;
  map_lng: number;
  map_zoom: number;
  map_link: string;
  currency: string;
  currency_symbol: string;
  message_template: string;
  social_facebook: string;
  social_instagram: string;
  social_youtube: string;
  social_linkedin: string;
  footer_text: string;
  meta_description: string;
  log_inquiries: boolean;
}

export interface ContactPayload { name: string; email?: string; phone?: string; subject?: string; message: string; website?: string }
