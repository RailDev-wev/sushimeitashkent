export type MenuCategory = { id: string; name: string };

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  pcs?: number;
  isNew?: boolean;
  image?: string;
};
