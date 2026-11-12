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
  /** Photo URL; falls back to the emoji in `image` when absent */
  imageUrl?: string;
  imageFit?: "cover" | "contain";
}

export interface Category {
  id: string;
  name: string;
  image: string;
  color: string;
  imageUrl?: string;
  imageFit?: "cover" | "contain";
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  color: string;
  /** Gradient stops for the hero banner, dark enough for white text */
  gradient: [string, string];
  cta: string;
  /** Up to three product photos shown as overlapping circles */
  images: string[];
}

export const categories: Category[] = [
  {
    id: "fruits",
    name: "Fruits &\nVeggies",
    image: "🥦",
    color: "#E8F5E9",
    imageUrl:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
  {
    id: "dairy",
    name: "Dairy &\nBreakfast",
    image: "🥛",
    color: "#FFF8E1",
    imageUrl:
      "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
  {
    id: "snacks",
    name: "Snacks &\nMunchies",
    image: "🍿",
    color: "#FCE4EC",
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/149/150/2016/front_en.5.400.jpg",
    imageFit: "contain",
  },
  {
    id: "beverages",
    name: "Cold Drinks\n& Juices",
    image: "🥤",
    color: "#E3F2FD",
    imageUrl:
      "https://images.openfoodfacts.org/images/products/394/876/401/2273/front_en.7.400.jpg",
    imageFit: "contain",
  },
  {
    id: "bakery",
    name: "Bakery &\nBiscuits",
    image: "🍞",
    color: "#FFF3E0",
    imageUrl:
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
  {
    id: "cleaning",
    name: "Cleaning\nEssentials",
    image: "🧹",
    color: "#F3E5F5",
    imageUrl:
      "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
  {
    id: "personal",
    name: "Personal\nCare",
    image: "🧴",
    color: "#E0F7FA",
    imageUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
  {
    id: "frozen",
    name: "Frozen\nFood",
    image: "🧊",
    color: "#E8EAF6",
    imageUrl:
      "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
  },
];

export const products: Product[] = [
  // Fruits & Veggies
  {
    id: "p1",
    imageUrl:
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
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
    imageUrl:
      "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
    name: "Tomato - Hybrid",
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
    imageUrl:
      "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
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
    imageUrl:
      "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=400&h=400&q=70",
    imageFit: "cover",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/126/226/0121/front_en.52.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/126/201/0016/front_en.53.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/126/218/0115/front_en.6.400.jpg",
    imageFit: "contain",
    name: "Amul Malai Paneer Fresh",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/164/809/7983/front_en.12.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/149/150/2016/front_en.5.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/400/440/0694/front_en.4.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/172/501/3684/front_en.24.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/870/149/137/2196/front_en.3.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/394/876/401/2273/front_en.7.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/608/060/4690/front_en.22.400.jpg",
    imageFit: "contain",
    name: "Paper Boat Swing Coconut Water",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/000/009/016/2602/front_en.151.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/394/876/403/2912/front_en.12.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/106/309/2686/front_en.3.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/404/355/1548/front_en.15.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/172/501/5275/front_en.51.400.jpg",
    imageFit: "contain",
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
    imageUrl:
      "https://images.openfoodfacts.org/images/products/890/171/913/4845/front_en.11.400.jpg",
    imageFit: "contain",
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

const photo = (id: string) => products.find((p) => p.id === id)?.imageUrl ?? "";

export const banners: Banner[] = [
  {
    id: "b1",
    image: "🛒",
    title: "Groceries in\n{eta} minutes",
    subtitle: "Free delivery on your first order",
    color: "#DCF7E6",
    gradient: ["#238A47", "#42C86E"],
    cta: "Order now",
    images: [photo("p5"), photo("p1"), photo("p9")],
  },
  {
    id: "b2",
    image: "🥦",
    title: "Fresh veggies,\npicked this morning",
    subtitle: "Farm fresh, delivered daily",
    color: "#F1FCF5",
    gradient: ["#1B6B3A", "#5BD686"],
    cta: "Shop fresh",
    images: [photo("p2"), photo("p4"), photo("p3")],
  },
  {
    id: "b3",
    image: "🎁",
    title: "Weekend savings\nup to 40% off",
    subtitle: "On 500+ everyday products",
    color: "#FFF3CC",
    gradient: ["#B45309", "#F59E0B"],
    cta: "Grab deals",
    images: [photo("p17"), photo("p13"), photo("p20")],
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
