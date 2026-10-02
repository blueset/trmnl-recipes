// Recipes whose instances this editor can read and write.
// A recipe is matched by the custom field keys present in an instance's plugin settings details.

export const RECIPES = [
  {
    id: 'custom-next-holiday',
    title: 'Custom Next Holiday and Countdown',
    recipeId: 257171,
    url: 'https://github.com/blueset/trmnl-recipes/tree/master/custom-next-holiday',
    fields: {
      list: 'holidays',
      number: 'holiday_number',
    },
  },
];

/** Find the registered recipe matching a set of field keys. */
export function matchRecipeByKeys(keys) {
  const set = keys instanceof Set ? keys : new Set(keys);
  return RECIPES.find((r) => Object.values(r.fields).every((k) => set.has(k))) || null;
}

export const recipeById = (id) => RECIPES.find((r) => r.id === id) || null;
