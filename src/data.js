export const INITIAL_ITEMS = [
  // Rau
  {
    id: '1',
    name: 'Rau muống',
    price: 10,
    category: 'rau',
    unit: 'mớ',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['muong', 'rau muong']
  },
  {
    id: '2',
    name: 'Rau mồng tơi',
    price: 8,
    category: 'rau',
    unit: 'mớ',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['toi', 'mong toi', 'rau mong toi']
  },
  {
    id: '3',
    name: 'Đỗ cove / Đỗ que',
    price: 30,
    category: 'rau',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['do', 'do cove', 'do que', 'dau que']
  },
  {
    id: '4',
    name: 'Cà chua',
    price: 20,
    category: 'rau',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['ca chua', 'chua']
  },
  {
    id: '5',
    name: 'Bắp cải',
    price: 15,
    category: 'rau',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['bap cai', 'cai']
  },
  // Hàng khô
  {
    id: '6',
    name: 'Tỏi ta',
    price: 45,
    category: 'kho',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['toi', 'toi ta', 'cu toi']
  },
  {
    id: '7',
    name: 'Hành khô',
    price: 35,
    category: 'kho',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['hanh', 'hanh kho', 'cu hanh']
  },
  {
    id: '8',
    name: 'Gừng tươi',
    price: 25,
    category: 'kho',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['gung', 'gung tuoi']
  },
  {
    id: '9',
    name: 'Nấm hương khô',
    price: 220,
    category: 'kho',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['nam', 'nam huong']
  },
  // Hoa quả
  {
    id: '10',
    name: 'Táo Mỹ / Táo Fuji',
    price: 60,
    category: 'qua',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['tao', 'tao my']
  },
  {
    id: '11',
    name: 'Cam sành',
    price: 25,
    category: 'qua',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['cam', 'cam sanh']
  },
  {
    id: '12',
    name: 'Xoài cát',
    price: 40,
    category: 'qua',
    unit: 'kg',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['xoai', 'xoai cat']
  },
  {
    id: '13',
    name: 'Chuối tiêu',
    price: 20,
    category: 'qua',
    unit: 'nải',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
    updatedAt: new Date().toISOString(),
    keywords: ['chuoi', 'chuoi tieu']
  }
];

export const CATEGORY_MAP = {
  rau: { label: 'Rau Tươi', color: 'emerald', icon: '🥦' },
  kho: { label: 'Hàng Khô', color: 'amber', icon: '🧅' },
  qua: { label: 'Hoa Quả', color: 'rose', icon: '🍎' },
};
