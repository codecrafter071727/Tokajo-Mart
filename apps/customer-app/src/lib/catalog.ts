import type {
  Category as CategoryDto,
  Product as ProductDto,
  ProductDetail as ProductDetailDto,
} from "@qc/contracts";
import type { Category, Product, ProductDetail } from "./mockData";

/** API money is integer paise, the UI works in rupees. */
const rupees = (paise: number) => paise / 100;

export function toProduct(dto: ProductDto): Product {
  return {
    id: dto.id,
    name: dto.name,
    unit: dto.unit,
    price: rupees(dto.pricePaise),
    mrp: rupees(dto.mrpPaise),
    image: dto.emoji,
    imageUrl: dto.imageUrl ?? undefined,
    imageFit: dto.imageFit,
    discount: dto.discountPercent > 0 ? dto.discountPercent : undefined,
    categoryId: dto.categoryId,
    deliveryMins: dto.deliveryMins,
    optionsCount: dto.optionsCount ?? undefined,
    description: dto.description ?? undefined,
    brand: dto.brand ?? undefined,
    tags: dto.tags?.length ? dto.tags : undefined,
    groupId: dto.groupId ?? undefined,
    variantLabel: dto.variantLabel ?? undefined,
  };
}

export function toProductDetail(dto: ProductDetailDto): ProductDetail {
  return {
    ...toProduct(dto),
    variants: dto.variants.map((v) => ({
      id: v.id,
      label: v.label,
      unit: v.unit,
      price: rupees(v.pricePaise),
      mrp: rupees(v.mrpPaise),
      imageUrl: v.imageUrl ?? undefined,
    })),
    images: dto.images.map((i) => ({ url: i.url, alt: i.alt })),
    groupName: dto.group?.name,
  };
}

/** A product without the detail fields (fixtures, older data) as a detail with no extras. */
export function asDetail(product: Product): ProductDetail {
  return {
    ...product,
    variants: [],
    images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
  };
}

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    name: dto.name,
    image: dto.emoji,
    color: dto.color,
    imageUrl: dto.imageUrl ?? undefined,
    imageFit: dto.imageFit,
    parentId: dto.parentId ?? undefined,
  };
}

/** Top level categories in order, each with its sub categories (the server sends them in order). */
export function categoryTree(categories: Category[]): (Category & { children: Category[] })[] {
  const ids = new Set(categories.map((c) => c.id));
  return categories
    .filter((c) => !c.parentId || !ids.has(c.parentId))
    .map((root) => ({ ...root, children: categories.filter((c) => c.parentId === root.id) }));
}
