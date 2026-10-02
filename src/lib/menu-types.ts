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

export type BranchInfo = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  mapUrl: string;
};

/** branchId -> ids of items that branch has switched off */
export type StopList = Record<string, string[]>;
