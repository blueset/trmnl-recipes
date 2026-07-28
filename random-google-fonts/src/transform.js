// Font selection, filter evaluation and sample text override resolution all happen
// server-side in https://github.com/blueset/trmnl-deno-deploy (/google-fonts).
// This transform only unwraps the polling response and surfaces errors on screen.
const ENDPOINT = "https://trmnl-deno-deploy.1a23.deno.net/google-fonts";

// TRMNL discards the response body of a failed poll, so the API's error envelope
// never reaches us. Re-request once to recover a message worth showing the user.
async function describeFailure(input) {
  try {
    const fields = input?.trmnl?.plugin_settings?.custom_fields_values || {};
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: fields.filter || "",
        override: fields.override || "",
      }),
    });
    const body = await response.json().catch(() => null);
    if (body?.error) {
      return `${body.error.code || "error"}: ${body.error.message || "unknown error"}`;
    }
    return `no font returned by the Google Fonts API (HTTP ${response.status})`;
  } catch (error) {
    return `could not reach the Google Fonts API: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function transform(input) {
  // A single polling URL is delivered at the top level; IDX_0 is kept as a
  // fallback in case the response ever gets namespaced again.
  const data = (input && input.IDX_0) || input || {};
  const errors = Array.isArray(data.errors) ? [...data.errors] : [];

  if (data.error) {
    errors.push(`${data.error.code || "error"}: ${data.error.message || "unknown error"}`);
  } else if (!data.font || !data.font.name) {
    errors.push(await describeFailure(input));
  }

  return {
    font: data.font || {},
    sampleText: data.sampleText,
    script: data.script,
    axes: data.axes || {},
    sampleOverrides: data.sampleOverrides || { large: null, small: null },
    errors,
  };
}
