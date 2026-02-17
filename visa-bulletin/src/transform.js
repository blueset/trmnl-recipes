function transform(input) {
  const { category, region } = input.trmnl.plugin_settings.custom_fields_values;
  const history = input.data;
  for (const key of Object.keys(history)) {
    if (key.includes("_history") && key !== `${region}_history`) {
      delete history[key];
    } else if (key === `${region}_history`) {
      for (const catKey of Object.keys(history[key])) {
        if (catKey !== category) {
          delete history[key][catKey];
        }
      }
    }
  }
  input.data = history;
  return input;
}