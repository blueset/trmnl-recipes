# Onboarding a new recipe

To onboard a new recipe into the repository, please follow these steps:

## Overview

- You are provided with a path of the recipe to onboard. Hereafter, refer to this path as `<RECIPE_PATH>`.
- Screenshots are located at `<RECIPE_PATH>/images/`, following the naming convention `*f.png`, `*h.png`, `*v.png`, `*q.png` for “Full”, “Horizontal”, “Vertical”, andm “Quad” views respectively. Asterisks represent optional variants of screenshots.
- Metadata about the recipe can be found in `<RECIPE_PATH>/src/settings.yml`.
- If the recipe has been published on TRMNL, try to fetch `https://trmnl.com/recipes/<RECIPE_ID>.json` with headers `Accept: application/json` and `User-Agent: Mozilla/5.0`, then read `.data.icon_url` and `.data.icon_content_type`.
- If icon metadata is available, download the icon into `<RECIPE_PATH>/images/icon.<ext>`, where `<ext>` is derived from the MIME type. If icon metadata is missing, skip the icon and continue onboarding.

## Your tasks

### Create recipe README.md

1. Create a `README.md` file at `<RECIPE_PATH>/README.md`.
2. The README should follow the template below:

```md
# {% if icon is available %}<img src="./images/icon.<ext>" alt="Icon" height="50"> {% endif %}<RECIPE_NAME>

![Connections](https://trmnl-badges.gohk.xyz/badge/connections?recipe=<RECIPE_ID>)

<RECIPE_DESCRIPTION_IN_MARKDOWN>

<a href="https://trmnl.com/recipes/<RECIPE_ID>" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../.assets/trmnl-badge-show-it-on-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="../.assets/trmnl-badge-show-it-on-light.svg">
    <img alt="Show it on TRMNL" src="../.assets/trmnl-badge-show-it-on-dark.svg" height="40">
  </picture>
</a>

## Screenshot

{% if only one set of screenshots is present %}
| Full | Vertical |
| :---: | :---: |
| ![Screenshot](./images/f.png) | ![Screenshot](./images/v.png) |
| Horizontal | Quad |
| ![Screenshot](./images/h.png) | ![Screenshot](./images/q.png) |
{% else if multiple sets of screenshots are present %}
{% for each set of screenshots %}

### <VARIANT_NAME>

| Full | Vertical |
| :---: | :---: |
| ![Screenshot](./images/<VARIANT>-f.png) | ![Screenshot](./images/<VARIANT>-v.png) |
| Horizontal | Quad |
| ![Screenshot](./images/<VARIANT>-h.png) | ![Screenshot](./images/<VARIANT>-q.png) |

{% endfor %}
{% endif %}

## Parameters

- <PARAMETER_1_NAME>  
  <PARAMETER_1_OPTIONS>, default: <PARAMETER_1_DEFAULT_IF_ANY>
- <PARAMETER_2_NAME>  
  <PARAMETER_2_OPTIONS>, default: <PARAMETER_2_DEFAULT_IF_ANY>
- ...

```

Replace placeholders with actual values from the recipe metadata and screenshots. For parameters, list each parameter's name, options, and default value if applicable. If it is a select-like parameter, only include the user-facing names of the options.

If an icon was downloaded, use the iconized heading shown above. Otherwise, fall back to a plain `# <RECIPE_NAME>` heading.

### Add recipe to main README.md

At the end of the main `README.md` file in the repository root, add a section for the new recipe using the following template:

```md
<a id="<RECIPE_ANCHOR>"></a>
## {% if icon is available %}<img src="./<RECIPE_PATH>/images/icon.<ext>" alt="Icon" height="50"> {% endif %}<RECIPE_NAME>

![Connections](https://trmnl-badges.gohk.xyz/badge/connections?recipe=<RECIPE_ID>)

<RECIPE_DESCRIPTION_IN_PLAIN_TEXT>

[Learn More](./<RECIPE_PATH>/README.md)

<a href="https://trmnl.com/recipes/<RECIPE_ID>" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".assets/trmnl-badge-show-it-on-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".assets/trmnl-badge-show-it-on-light.svg">
    <img alt="Show it on TRMNL" src=".assets/trmnl-badge-show-it-on-dark.svg" height="40">
  </picture>
</a>

![Screenshot](./<RECIPE_PATH>/images/f.png)
<!-- if multiple screenshot variants exist, use the most representative one -->
```

Also update the table of contents at the top of the main `README.md` to include a link to the new recipe section.

When the main `README.md` uses the icon-table table of contents format, add the recipe as a new table cell using this structure:

```html
<td align="center"><img src="./<RECIPE_PATH>/images/icon.<ext>" alt="Icon" height="50"><br><a href="#<RECIPE_ANCHOR>"><RECIPE_NAME></a></td>
```

If no icon is available, use a text-only fallback inside the cell:

```html
<td align="center"><a href="#<RECIPE_ANCHOR>"><RECIPE_NAME></a></td>
```

If the main `README.md` still uses a bullet-list table of contents instead, add a normal markdown bullet link there instead.

When adding the main README section, preserve the explicit anchor before the heading so the table-of-contents link remains stable even when the heading contains an HTML image.
