function transform(input) {
  const region = "cn";
  const history = input.data.history;
  for (const key in Object.keys(history)) {
    if (key.includes("_history") && key !== `${region}_history`) {
      delete history[key];
    }
  }
  return input;
}