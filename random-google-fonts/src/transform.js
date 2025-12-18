function transform(input) {
  const errors = [];
  const data = input.IDX_0;
  let fonts = data.fonts;

  try {
    const filter = input.trmnl.plugin_settings.custom_fields_values.filter;
    if (filter) {
      fonts = fonts.filter((f, index, array) => eval(`(function() { return ${filter}; }).call({ f, index, array })`));
    }
  } catch (error) {
    console.error("failed to apply filter", error);
    errors.push(`failed to apply filter: ${error instanceof Error ? error.message : String(error)}\n${error instanceof Error && error.stack ? error.stack : ''}`);
  }

  let font, sampleText;

  try {
    font = fonts[Math.floor(Math.random() * fonts.length)] || {};
    sampleText = 
      font.sample_text?.[0] ||
      data.sample_texts[font.primary_language]?.sample_text?.[0] ||
      data.sample_texts.en_Latn.sample_text[0];
  } catch (error) {
    console.error("failed to select font or sample text", error);
    errors.push(`failed to select font or sample text: ${error instanceof Error ? error.message : String(error)}\n${error instanceof Error && error.stack ? error.stack : ''}`);
  }

  return {
    font,
    sampleText,
    randomizerKey: input.IDX_1.text,
    errors,
  }
}