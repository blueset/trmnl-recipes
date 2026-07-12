export const utilityGroups = [
  {
    name: "content",
    varPrefix: "richtext",
    variants: [
      "small",
      "base",
      "large",
      "xlarge",
      "xxlarge",
      "xxxlarge",
    ],
  },
  {
    name: "description",
    varPrefix: "description",
    variants: ["base", "large", "xlarge"],
  },
];

export function createUtilities() {
  const utilities = {};

  for (const { name, varPrefix, variants } of utilityGroups) {
    for (const variant of variants) {
      const infix = variant === "base" ? "" : `-${variant}`;
      utilities[`.${name}-${variant}`] = {
        "font-family": `var(--${varPrefix}${infix}-font-family)`,
        "font-size": `var(--${varPrefix}${infix}-font-size)`,
        "line-height": `var(--${varPrefix}${infix}-line-height)`,
        "font-weight": `var(--font-weight-${name}-${variant})`,
        "-webkit-font-smoothing": `var(--${varPrefix}${infix}-font-smoothing)`,
      };
    }
  }

  return utilities;
}