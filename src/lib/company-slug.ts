import { randomUUID } from "node:crypto";

const companySlugPrefix = "site-";

export function createCompanySlug() {
  return `${companySlugPrefix}${randomUUID().replaceAll("-", "")}`;
}
