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
  optionsCount?: number;
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
    optionsCount: 2,
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
    optionsCount: 3,
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
    optionsCount: 2,
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

export interface HomeTile {
  id: string;
  name: string;
  image: string;
  categoryId: string;
}

export interface HomeSection {
  id: string;
  title: string;
  tiles: HomeTile[];
}

const tile = (id: string, name: string, photo: string, categoryId: string): HomeTile => ({
  id,
  name,
  categoryId,
  image: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=400&q=60`,
});

/** Home category grids, matching the Blinkit scrolled home. */
export const homeSections: HomeSection[] = [
  {
    id: "grocery",
    title: "Grocery & Kitchen",
    tiles: [
      tile("veg", "Vegetables\n& Fruits", "photo-1610832958506-aa56368176cf", "fruits"),
      tile("atta", "Atta, Rice\n& Dal", "photo-1586201375761-83865001e31c", "bakery"),
      tile("oil", "Oil, Ghee\n& Masala", "photo-1474979266404-7eaacbcd87c5", "dairy"),
      tile("dairy", "Dairy, Bread\n& Eggs", "photo-1550583724-b2692b85b150", "dairy"),
      tile("bakery", "Bakery\n& Biscuits", "photo-1558961363-fa8fdf82db35", "bakery"),
      tile("dry", "Dry Fruits\n& Cereals", "photo-1596591868231-05e908752cc6", "snacks"),
      tile("meat", "Chicken,\nMeat & Fish", "photo-1604503468506-a8da13d82791", "fruits"),
      tile("kitchen", "Kitchenware\n& Appliances", "photo-1570222094114-d054a817e56b", "cleaning"),
    ],
  },
  {
    id: "snacks",
    title: "Snacks & Drinks",
    tiles: [
      tile("chips", "Chips &\nNamkeen", "photo-1566478989037-eec170784d0b", "snacks"),
      tile("sweets", "Sweets &\nChocolates", "photo-1606312619070-d48b4c652a52", "bakery"),
      tile("drinks", "Drinks\n& Juices", "photo-1629203851122-3726ecdf080e", "beverages"),
      tile("tea", "Tea, Coffee &\nMilk Drinks", "photo-1564890369478-c89ca6d9cde9", "beverages"),
      tile("instant", "Instant Food", "photo-1612929633738-8fe44f7ec841", "snacks"),
      tile("sauces", "Sauces &\nSpreads", "photo-1472476443507-c7a5948772fc", "snacks"),
      tile("paan", "Paan Corner", "photo-1596040033229-a9821ebd058d", "snacks"),
      tile("icecream", "Ice Creams\n& More", "photo-1497034825429-c343d7c6a68f", "frozen"),
    ],
  },
];

export const homeShortcuts = [
  { id: "all", label: "All", emoji: "🧺" },
  { id: "diwali", label: "Diwali", emoji: "🪔", badge: "New" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "electronics", label: "Electronics", emoji: "🎧" },
  { id: "beauty", label: "Beauty", emoji: "💄" },
  { id: "pharma", label: "Pharma", emoji: "💊" },
];

export const getFeaturedProducts = (): Product[] => products.slice(0, 8);

export const getProductById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);

export const getSuggestedProducts = (excludeIds: string[]): Product[] =>
  products.filter((p) => !excludeIds.includes(p.id)).slice(0, 6);

export const getRecentlyViewedProducts = (): Product[] =>
  products.filter((_, idx) => [4, 0, 8, 12, 1].includes(idx));
