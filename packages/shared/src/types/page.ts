import type { EditorialState } from '../constants/editorial-states.js';
import type { LocalizedValue, MediaAsset } from './resource.js';

/** Pagina editorial */
export interface Page {
  id: string;
  slug: string;
  template: string;
  title: LocalizedValue;
  content: LocalizedValue;
  seoTitle: LocalizedValue;
  seoDescription: LocalizedValue;
  multimedia: MediaAsset[];
  status: EditorialState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface PageInput {
  slug?: string;
  template?: string;
  title: LocalizedValue;
  content?: LocalizedValue;
  seoTitle?: LocalizedValue;
  seoDescription?: LocalizedValue;
}
