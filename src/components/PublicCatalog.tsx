"use client";

import Link from "next/link";
import { ProductCardContent, ProductCatalogView } from "@/components/ProductCatalogView";
import type { CatalogCategory, CatalogProduct, Company } from "@/types";

type PublicCatalogProps = {
  company: Pick<Company, "name" | "slug" | "paid_until">;
  categories: CatalogCategory[];
  products: CatalogProduct[];
};

export function PublicCatalog({ company, categories, products }: PublicCatalogProps) {
  return (
    <ProductCatalogView
      asMain
      categories={categories}
      company={company}
      products={products}
      renderProduct={(product, index) => (
        <Link
          className="product-card"
          data-product-code={product.product_code}
          href={`/c/${company.slug}/p/${product.product_code}`}
        >
          <ProductCardContent priority={index < 2} product={product} />
        </Link>
      )}
    />
  );
}
