import test from 'node:test';
import assert from 'node:assert/strict';
import recipes from '../src/data/howToCookRecipes.json' with { type: 'json' };
import { violatesRestrictions } from '../src/utils/recipeMatching.js';

function recipe(title) {
  const found = recipes.find((item) => item.title === title);
  assert.ok(found, `Missing recipe fixture: ${title}`);
  return found;
}

test('vegetarian mode blocks meat and seafood variants', () => {
  const preferences = { dietType: ['vegetarian'] };
  for (const title of [
    '黔式腊肠娃娃菜',
    '蛏抱蛋',
    '葱烧海参',
    '简易红烧肉',
    '口水鸡',
    '贵州辣子鸡',
    '姜炒鸡',
    '椒盐排条',
    '鱼香肉丝',
  ]) {
    assert.equal(violatesRestrictions(recipe(title), preferences), true, title);
  }
});

test('no-pork mode blocks processed pork names', () => {
  const preferences = { dietType: ['noPork'] };
  for (const title of [
    '黔式腊肠娃娃菜',
    '猪油拌饭',
    '鸡蛋三明治',
    '简易红烧肉',
    '椒盐排条',
    '鱼香肉丝',
  ]) {
    assert.equal(violatesRestrictions(recipe(title), preferences), true, title);
  }
});

test('no-beef mode blocks beef cut and title variants without blocking milk', () => {
  const preferences = { dietType: ['noBeef'] };
  for (const title of ['澳门湿版免治牛肉饭', '孜然牛肉', '酱牛肉']) {
    assert.equal(violatesRestrictions(recipe(title), preferences), true, title);
  }
  assert.equal(violatesRestrictions(recipe('牛奶燕麦'), preferences), false);
});

test('allergen families cover egg, dairy and peanut derivatives', () => {
  assert.equal(
    violatesRestrictions(recipe('金枪鱼酱三明治'), { allergens: ['鸡蛋'] }),
    true
  );
  assert.equal(
    violatesRestrictions(recipe('奶油蘑菇汤'), { allergens: ['牛奶'] }),
    true
  );
  assert.equal(
    violatesRestrictions(recipe('口水鸡'), { allergens: ['花生'] }),
    true
  );
});

test('dataset scan has no obvious diet restriction leaks', () => {
  const vegetarianLeaks = recipes.filter(
    (item) =>
      ['meat_dish', 'aquatic'].includes(item.category) &&
      !violatesRestrictions(item, { dietType: ['vegetarian'] })
  );
  const porkPattern =
    /猪|五花|排骨|猪蹄|猪油|大肉|大排|瘦肉|里脊肉|肉末|腊肠|培根|火腿/;
  const porkLeaks = recipes.filter(
    (item) =>
      porkPattern.test([item.title, ...item.ingredientKeys].join('|')) &&
      !violatesRestrictions(item, { dietType: ['noPork'] })
  );
  const beefPattern =
    /牛肉|肥牛|牛腩|牛排|牛柳|牛里脊|牛丸|牛杂|免治牛|黄牛/;
  const beefLeaks = recipes.filter(
    (item) =>
      beefPattern.test([item.title, ...item.ingredientKeys].join('|')) &&
      !violatesRestrictions(item, { dietType: ['noBeef'] })
  );

  assert.deepEqual(vegetarianLeaks.map((item) => item.title), []);
  assert.deepEqual(porkLeaks.map((item) => item.title), []);
  assert.deepEqual(beefLeaks.map((item) => item.title), []);
});

test('beef mince is not pork mince', async () => {
  const { explodeIngredientKeys } = await import('../src/utils/ingredientNormalize.js');
  assert.deepEqual(explodeIngredientKeys('牛肉末'), ['牛肉末']);
  assert.deepEqual(explodeIngredientKeys('猪肉末'), ['肉末']);
  const beefOnly = {
    title: '牛肉末炒饭',
    ingredientKeys: ['牛肉末', '米饭'],
    requiredItems: ['牛肉末', '米饭'],
  };
  assert.equal(violatesRestrictions(beefOnly, { dietType: ['noPork'] }), false);
  assert.equal(violatesRestrictions(beefOnly, { dietType: ['noBeef'] }), true);
  assert.equal(
    violatesRestrictions(recipe('冬瓜酿肉'), { dietType: ['noPork'] }),
    true
  );
});
