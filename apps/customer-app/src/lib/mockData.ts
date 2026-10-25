// Mock data for Tokajo Mart customer app

export interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  mrp: number;
  image: string;
  discount?: number;
  categoryId: string;
  deliveryMins?: number;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  color: string;
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  color: string;
}

export const categories: Category[] = [
  { id: "fruits", name: "Fruits &\nVeggies", image: "🥦", color: "#E8F5E9" },
  { id: "dairy", name: "Dairy &\nBreakfast", image: "🥛", color: "#FFF8E1" },
  { id: "snacks", name: "Snacks &\nMunchies", image: "🍿", color: "#FCE4EC" },
  { id: "beverages", name: "Cold Drinks\n& Juices", image: "🥤", color: "#E3F2FD" },
  { id: "bakery", name: "Bakery &\nBiscuits", image: "🍞", color: "#FFF3E0" },
  { id: "cleaning", name: "Cleaning\nEssentials", image: "🧹", color: "#F3E5F5" },
  { id: "personal", name: "Personal\nCare", image: "🧴", color: "#E0F7FA" },
  { id: "frozen", name: "Frozen\nFood", image: "🧊", color: "#E8EAF6" },
];

export const products: Product[] = [
  // Fruits & Veggies
  {
    id: "p1",
    name: "Fresho Banana - Robusta",
    unit: "6 pcs (approx 500 g)",
    price: 25,
    mrp: 35,
    image: "🍌",
    discount: 29,
    categoryId: "fruits",
    deliveryMins: 10,
  },
  {
    id: "p2",
    name: "Tomato — Hybrid",
    unit: "500 g",
    price: 18,
    mrp: 24,
    image: "🍅",
    discount: 25,
    categoryId: "fruits",
    deliveryMins: 10,
  },
  {
    id: "p3",
    name: "Onion",
    unit: "1 kg",
    price: 35,
    mrp: 45,
    image: "🧅",
    discount: 22,
    categoryId: "fruits",
    deliveryMins: 10,
  },
  {
    id: "p4",
    name: "Green Capsicum",
    unit: "250 g",
    price: 20,
    mrp: 28,
    image: "🫑",
    discount: 29,
    categoryId: "fruits",
    deliveryMins: 10,
  },
  // Dairy
  {
    id: "p5",
    name: "Amul Taaza Toned Fresh Milk",
    unit: "500 ml",
    price: 29,
    mrp: 31,
    image: "🥛",
    discount: 6,
    categoryId: "dairy",
    deliveryMins: 8,
  },
  {
    id: "p6",
    name: "Amul Butter",
    unit: "100 g",
    price: 55,
    mrp: 58,
    image: "🧈",
    discount: 5,
    categoryId: "dairy",
    deliveryMins: 8,
  },
  {
    id: "p7",
    name: "Britannia Paneer",
    unit: "200 g",
    price: 89,
    mrp: 95,
    image: "🧀",
    discount: 6,
    categoryId: "dairy",
    deliveryMins: 8,
  },
  {
    id: "p8",
    name: "Mother Dairy Curd",
    unit: "400 g",
    price: 45,
    mrp: 50,
    image: "🍶",
    discount: 10,
    categoryId: "dairy",
    deliveryMins: 8,
  },
  // Snacks
  {
    id: "p9",
    name: "Lay's Potato Chips Classic Salted",
    unit: "52 g",
    price: 20,
    mrp: 20,
    image: "🥔",
    categoryId: "snacks",
    deliveryMins: 12,
  },
  {
    id: "p10",
    name: "Haldirams Bhujia",
    unit: "200 g",
    price: 55,
    mrp: 60,
    image: "🫘",
    discount: 8,
    categoryId: "snacks",
    deliveryMins: 12,
  },
  {
    id: "p11",
    name: "Bingo Mad Angles Achaari Masti",
    unit: "135 g",
    price: 30,
    mrp: 35,
    image: "🍘",
    discount: 14,
    categoryId: "snacks",
    deliveryMins: 12,
  },
  {
    id: "p12",
    name: "Kurkure Masala Munch",
    unit: "90 g",
    price: 20,
    mrp: 20,
    image: "🌽",
    categoryId: "snacks",
    deliveryMins: 12,
  },
  // Beverages
  {
    id: "p13",
    name: "Coca-Cola Soft Drink",
    unit: "750 ml",
    price: 38,
    mrp: 40,
    image: "🥤",
    discount: 5,
    categoryId: "beverages",
    deliveryMins: 10,
  },
  {
    id: "p14",
    name: "Paper Boat Aamras",
    unit: "250 ml",
    price: 30,
    mrp: 35,
    image: "🧃",
    discount: 14,
    categoryId: "beverages",
    deliveryMins: 10,
  },
  {
    id: "p15",
    name: "Red Bull Energy Drink",
    unit: "250 ml",
    price: 115,
    mrp: 125,
    image: "🐂",
    discount: 8,
    categoryId: "beverages",
    deliveryMins: 10,
  },
  {
    id: "p16",
    name: "Sprite Soft Drink",
    unit: "750 ml",
    price: 38,
    mrp: 40,
    image: "💧",
    discount: 5,
    categoryId: "beverages",
    deliveryMins: 10,
  },
  // Bakery
  {
    id: "p17",
    name: "Britannia Good Day Butter Cookies",
    unit: "150 g",
    price: 25,
    mrp: 30,
    image: "🍪",
    discount: 17,
    categoryId: "bakery",
    deliveryMins: 10,
  },
  {
    id: "p18",
    name: "Modern Atta Bread",
    unit: "400 g",
    price: 45,
    mrp: 50,
    image: "🍞",
    discount: 10,
    categoryId: "bakery",
    deliveryMins: 10,
  },
  {
    id: "p19",
    name: "Sunfeast Dark Fantasy Fills",
    unit: "150 g",
    price: 50,
    mrp: 55,
    image: "🍫",
    discount: 9,
    categoryId: "bakery",
    deliveryMins: 10,
  },
  {
    id: "p20",
    name: "Parle-G Original Glucose Biscuits",
    unit: "1 kg",
    price: 85,
    mrp: 90,
    image: "🫓",
    discount: 6,
    categoryId: "bakery",
    deliveryMins: 10,
  },
];

export const banners: Banner[] = [
  {
    id: "b1",
    image: "🛒",
    title: "Grocery delivery\nin 10 minutes",
    subtitle: "Free delivery on first order",
    color: "#FFF9E5",
  },
  {
    id: "b2",
    image: "🥦",
    title: "Fresh vegetables\nevery morning",
    subtitle: "Farm fresh, delivered daily",
    color: "#F7FFF9",
  },
  {
    id: "b3",
    image: "🎁",
    title: "Big savings this\nweekend",
    subtitle: "Up to 40% off on 500+ products",
    color: "#FFF3E0",
  },
];

export const getProductsByCategory = (categoryId: string): Product[] =>
  products.filter((p) => p.categoryId === categoryId);

export const getFeaturedProducts = (): Product[] => products.slice(0, 8);

export const getProductById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);

export const getSuggestedProducts = (excludeIds: string[]): Product[] =>
  products.filter((p) => !excludeIds.includes(p.id)).slice(0, 6);
