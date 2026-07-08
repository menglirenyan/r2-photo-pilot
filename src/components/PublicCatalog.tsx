"use client";

import Link from "next/link";
import { ProductCardContent, ProductCatalogView } from "@/components/ProductCatalogView";
import type { Category, CatalogProduct, Company } from "@/types";

type PublicCatalogProps = {
  company: Pick<Company, "name" | "slug" | "paid_until">;
  categories: Category[];
  products: CatalogProduct[];
};

export function PublicCatalog({ company, categories, products }: PublicCatalogProps) {
  return (
    <ProductCatalogView
      asMain
      categories={categories}
      company={company}
      products={products}
      renderProduct={(product) => (
        <Link className="product-card" href={`/${company.slug}/浏览页/p/${product.product_code}`}>
          <ProductCardContent product={product} />
        </Link>
      )}
    />
  );
}
