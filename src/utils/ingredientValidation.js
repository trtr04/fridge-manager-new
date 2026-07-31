const ALLOWED_STORAGE = new Set([
  'fridge',
  'freezer',
  'pantry',
  'condiment'
]);

export function validateIngredientDraft(draft, language = 'zh') {
  const message = (zh, en) => (language === 'en' ? en : zh);
  const name = typeof draft?.name === 'string' ? draft.name.trim() : '';
  const amount = Number(draft?.amount);
  const unit = typeof draft?.unit === 'string' ? draft.unit.trim() : '';
  const storage = draft?.storage === 'room' ? 'pantry' : draft?.storage;
  const category =
    typeof draft?.category === 'string' ? draft.category.trim() : '';
  const shelfLife = Number(draft?.shelfLife);
  const purchaseDate = draft?.purchaseDate;

  if (!name) {
    return { error: message('食材名称不能为空。', 'Ingredient name is required.') };
  }
  if (name.length > 120) {
    return {
      error: message(
        '食材名称不能超过 120 个字符。',
        'Ingredient name cannot exceed 120 characters.'
      )
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      error: message(
        '数量必须是大于 0 的数字。',
        'Amount must be greater than 0.'
      )
    };
  }
  if (amount > 1000000) {
    return {
      error: message(
        '数量不能超过 1,000,000。',
        'Amount cannot exceed 1,000,000.'
      )
    };
  }
  if (!unit || unit.length > 20) {
    return {
      error: message(
        '单位不能为空且不能超过 20 个字符。',
        'Unit is required and cannot exceed 20 characters.'
      )
    };
  }
  if (!ALLOWED_STORAGE.has(storage)) {
    return {
      error: message(
        '请选择有效的保存方式。',
        'Choose a valid storage location.'
      )
    };
  }
  if (!category || category.length > 50) {
    return {
      error: message(
        '分类不能为空且不能超过 50 个字符。',
        'Category is required and cannot exceed 50 characters.'
      )
    };
  }
  if (
    !Number.isInteger(shelfLife) ||
    shelfLife < 0 ||
    shelfLife > 36500
  ) {
    return {
      error: message(
        '保质期必须是 0 到 36500 之间的整数。',
        'Shelf life must be a whole number between 0 and 36,500.'
      )
    };
  }
  if (
    typeof purchaseDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
    Number.isNaN(Date.parse(`${purchaseDate}T00:00:00Z`))
  ) {
    return {
      error: message(
        '购买日期格式不正确。',
        'Purchase date is invalid.'
      )
    };
  }

  return {
    ingredient: {
      ...draft,
      name,
      amount,
      unit,
      storage,
      category,
      shelfLife,
      purchaseDate
    }
  };
}
