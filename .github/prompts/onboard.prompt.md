# Onboarding a new recipe

To onboard a new recipe into the repository, please follow these steps:

## Overview

- You are provided with a path of the recipe to onboard. Hereafter, refer to this path as `<RECIPE_PATH>`.
- Screenshots are located at `<RECIPE_PATH>/images/`, following the naming convention `*f.png`, `*h.png`, `*v.png`, `*q.png` for “Full”, “Horizontal”, “Vertical”, andm “Quad” views respectively. Asterisks represent optional variants of screenshots.
- Metadata about the recipe can be found in `<RECIPE_PATH>/src/settings.yml`.

## Your tasks

### Create recipe README.md

1. Create a `README.md` file at `<RECIPE_PATH>/README.md`.
2. The README should follow the template below:

```md
# <RECIPE_NAME>

<RECIPE_DESCRIPTION_IN_MARKDOWN>

[Install](https://usetrmnl.com/recipes/<RECIPE_ID>)

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

### Add recipe to main README.md

At the end of the main `README.md` file in the repository root, add a section for the new recipe using the following template:

```md
## <RECIPE_NAME>

<RECIPE_DESCRIPTION_IN_PLAIN_TEXT>

[Learn More](./<RECIPE_PATH>/README.md), [Install](https://usetrmnl.com/recipes/<RECIPE_ID>)

![Screenshot](./<RECIPE_PATH>/images/f.png)
<!-- if multiple screenshot variants exist, use the most representative one -->
```

Also update the table of contents at the top of the main `README.md` to include a link to the new recipe section.
