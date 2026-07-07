export type CompanyStatus = "active" | "inactive";
export type ProductStatus = "active" | "hidden";

export type Company = {
  id: string;
  company_number: number;
  name: string;
  slug: string;
  login_username: string;
  status: CompanyStatus;
  paid_until: string | null;
  contact_name: string;
  contact_note: string;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  sort_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  company_id: string;
  category_id: string;
  product_number: number;
  product_code: string;
  name: string;
  specification: string;
  unit_price: number | null;
  description: string;
  image_url: string;
  object_key: string;
  image_width: number | null;
  image_height: number | null;
  status: ProductStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  categories?: Pick<Category, "id" | "name" | "code"> | null;
};

export type ShipmentSheet = {
  id: string;
  company_id: string;
  title: string;
  customer_name: string;
  note: string;
  total_price: number;
  created_at: string;
};

export type ShipmentSheetItem = {
  id: string;
  shipment_sheet_id: string;
  product_id: string | null;
  name: string;
  specification: string;
  unit_price: number;
  quantity: number;
  line_price: number;
  sort_order: number;
};

export type CatalogProduct = Pick<
  Product,
  | "id"
  | "category_id"
  | "product_code"
  | "name"
  | "specification"
  | "unit_price"
  | "description"
  | "image_url"
  | "image_width"
  | "image_height"
>;

export type PublicCatalog = {
  company: Pick<Company, "id" | "name" | "slug" | "status" | "paid_until">;
  categories: Category[];
  products: CatalogProduct[];
  isAccessible: boolean;
};

export type AdminSnapshot = {
  companies: Company[];
  categories: Category[];
  products: Product[];
  shipmentSheets: ShipmentSheet[];
  configured: boolean;
};

export type SignUploadResponse = {
  signedUrl: string;
  publicUrl: string;
  objectKey: string;
  maxUploadBytes: number;
};

export type ShipmentDraftItem = {
  product_id?: string | null;
  name: string;
  specification: string;
  unit_price: number;
  quantity: number;
};
