/** Declarative definitions for the simple admin CRUD screens (one generic list + form). */

export type FieldType = 'text' | 'textarea' | 'html' | 'number' | 'checkbox' | 'select' | 'image' | 'datetime' | 'color' | 'maplink';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  folder?: string;
  help?: string;
  /** Number inputs: allow decimals. */
  step?: string;
}

/** Form model keys a `maplink` field writes in addition to its own value. */
export const MAPLINK_COORD_KEYS = ['latitude', 'longitude'] as const;

export interface ColumnDef { key: string; label: string; type?: 'image' | 'bool' | 'date' | 'color' }

export interface ResourceDef {
  key: string;
  api: string;
  title: string;
  singular: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  sortable?: boolean;
  /** Public URL prefix for a "View" link, e.g. "/blog/". */
  viewPrefix?: string;
}

const SEO: FieldDef[] = [
  { key: 'seo_title', label: 'SEO title', type: 'text' },
  { key: 'seo_description', label: 'SEO description', type: 'textarea' },
  { key: 'seo_keywords', label: 'SEO keywords', type: 'text' },
];
const SLUG: FieldDef = { key: 'slug', label: 'Slug', type: 'text', help: 'Leave empty to generate from the name.' };

export const RESOURCES: Record<string, ResourceDef> = {
  colors: {
    key: 'colors', api: 'colors', title: 'Colours', singular: 'colour',
    columns: [{ key: 'hex_code', label: '', type: 'color' }, { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }],
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, SLUG, { key: 'hex_code', label: 'Colour', type: 'color' }],
  },
  materials: {
    key: 'materials', api: 'materials', title: 'Materials', singular: 'material',
    columns: [{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }],
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, SLUG],
  },
  rooms: {
    key: 'rooms', api: 'rooms', title: 'Rooms', singular: 'room', sortable: true,
    columns: [{ key: 'image', label: '', type: 'image' }, { key: 'name', label: 'Name' }, { key: 'sort_order', label: 'Order' }],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }, SLUG,
      { key: 'image', label: 'Image', type: 'image', folder: 'rooms' }, { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
  },
  banners: {
    key: 'banners', api: 'banners', title: 'Banners & hero slides', singular: 'banner', sortable: true,
    columns: [
      { key: 'image', label: '', type: 'image' }, { key: 'title', label: 'Title' }, { key: 'placement', label: 'Placement' },
      { key: 'sort_order', label: 'Order' }, { key: 'is_active', label: 'Active', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'image', label: 'Image (desktop)', type: 'image', folder: 'banners', required: true, help: 'Hero: 1600×600, offers: 800×400.' },
      { key: 'mobile_image', label: 'Image (mobile)', type: 'image', folder: 'banners' },
      { key: 'link_url', label: 'Link', type: 'text', help: 'e.g. /category/sofa-set' },
      { key: 'button_text', label: 'Button text', type: 'text' },
      { key: 'placement', label: 'Placement', type: 'select', options: [
        { value: 'hero', label: 'Hero slider' }, { value: 'offer', label: 'Offer banner' }, { value: 'promo', label: 'Promo' }] },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'starts_at', label: 'Starts at', type: 'datetime' },
      { key: 'ends_at', label: 'Ends at', type: 'datetime' },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
  },
  showrooms: {
    key: 'showrooms', api: 'showrooms', title: 'Showrooms', singular: 'showroom', sortable: true, viewPrefix: '/showrooms/',
    columns: [{ key: 'name', label: 'Name' }, { key: 'city', label: 'City' }, { key: 'phone', label: 'Phone' }, { key: 'is_active', label: 'Active', type: 'bool' }],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }, SLUG,
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'address', label: 'Address', type: 'textarea', required: true },
      { key: 'phone', label: 'Phone', type: 'text' }, { key: 'email', label: 'Email', type: 'text' },
      { key: 'opening_hours', label: 'Opening hours', type: 'text', help: 'e.g. 10:00 AM – 8:00 PM' },
      { key: 'off_days', label: 'Off days', type: 'text' },
      { key: 'maplink', label: 'Google Maps link', type: 'maplink', help: 'Paste the link from Google Maps "Share" — the pin is placed automatically.', },
      { key: 'image', label: 'Photo', type: 'image', folder: 'showrooms' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
  },
  blog: {
    key: 'blog', api: 'blog-posts', title: 'Blog posts', singular: 'post', viewPrefix: '/blog/',
    columns: [
      { key: 'cover_image', label: '', type: 'image' }, { key: 'title', label: 'Title' },
      { key: 'published_at', label: 'Published', type: 'date' }, { key: 'is_published', label: 'Live', type: 'bool' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true }, SLUG,
      { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
      { key: 'cover_image', label: 'Cover image', type: 'image', folder: 'blog' },
      { key: 'body_html', label: 'Body', type: 'html' },
      { key: 'author', label: 'Author', type: 'text' }, { key: 'tags', label: 'Tags', type: 'text', help: 'Comma separated' },
      { key: 'published_at', label: 'Publish date', type: 'datetime' },
      { key: 'is_published', label: 'Published', type: 'checkbox' }, ...SEO,
    ],
  },
  pages: {
    key: 'pages', api: 'pages', title: 'Pages', singular: 'page', viewPrefix: '/page/',
    columns: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'is_published', label: 'Live', type: 'bool' }, { key: 'show_in_footer', label: 'Footer', type: 'bool' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true }, SLUG,
      { key: 'body_html', label: 'Content', type: 'html' },
      { key: 'is_published', label: 'Published', type: 'checkbox' }, { key: 'show_in_footer', label: 'Show in footer', type: 'checkbox' }, ...SEO,
    ],
  },
  faqs: {
    key: 'faqs', api: 'faqs', title: 'FAQs', singular: 'FAQ', sortable: true,
    columns: [{ key: 'question', label: 'Question' }, { key: 'group', label: 'Group' }, { key: 'show_on_home', label: 'Home', type: 'bool' }, { key: 'is_active', label: 'Active', type: 'bool' }],
    fields: [
      { key: 'question', label: 'Question', type: 'text', required: true },
      { key: 'answer_html', label: 'Answer', type: 'html', required: true },
      { key: 'group', label: 'Group', type: 'text' }, { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'show_on_home', label: 'Show on home page', type: 'checkbox' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
  },
};

export const DEFAULTS: Record<FieldType, unknown> = {
  text: '', textarea: '', html: '', number: null, checkbox: false, select: '', image: null, datetime: '', color: '#000000', maplink: '',
};
