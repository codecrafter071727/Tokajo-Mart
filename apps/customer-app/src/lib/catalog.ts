import type { Category as CategoryDto, Product as ProductDto } from "@qc/contracts";
import type { Category, Product } from "./mockData";

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
  };
}
