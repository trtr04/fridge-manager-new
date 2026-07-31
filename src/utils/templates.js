export const quickTemplates = [
  { name: '鸡蛋', unit: '个', shelfLife: 21, storage: 'fridge' },
  { name: '牛奶', unit: '盒', shelfLife: 7, storage: 'fridge' },
  { name: '洋葱', unit: '个', shelfLife: 14, storage: 'pantry' },
  { name: '土豆', unit: '个', shelfLife: 30, storage: 'pantry' },
  { name: '番茄', unit: '个', shelfLife: 7, storage: 'fridge' },
  { name: '鸡胸肉', unit: '块', shelfLife: 3, storage: 'fridge' }
];

export const mockRecipes = [
  {
    id: 1,
    name: '番茄炒蛋',
    image: '🍅🥚',
    steps: ['鸡蛋打散加盐', '番茄切块', '先炒蛋盛出', '炒番茄后加蛋翻炒'],
    ingredients: [
      { name: '鸡蛋', recommended: 3, actual: 0, unit: '个' },
      { name: '番茄', recommended: 2, actual: 0, unit: '个' }
    ],
    time: '10分钟',
    difficulty: '简单'
  },
  {
    id: 2,
    name: '洋葱炒牛肉',
    image: '🧅🥩',
    steps: ['牛肉切片腌制', '洋葱切丝', '热锅爆炒牛肉', '加洋葱翻炒调味'],
    ingredients: [
      { name: '牛肉', recommended: 200, actual: 0, unit: 'g' },
      { name: '洋葱', recommended: 1, actual: 0, unit: '个' }
    ],
    time: '15分钟',
    difficulty: '中等'
  },
  {
    id: 3,
    name: '土豆鸡块',
    image: '🥔🍗',
    steps: ['鸡块切块焯水', '土豆切块', '爆香调料', '加水炖煮20分钟'],
    ingredients: [
      { name: '鸡胸肉', recommended: 300, actual: 0, unit: 'g' },
      { name: '土豆', recommended: 2, actual: 0, unit: '个' }
    ],
    time: '30分钟',
    difficulty: '简单'
  }
];
