const fs = require("fs");
const zlib = require("zlib");

const vendor = fs.readFileSync("src/vendor.min.js");
const src = fs.readFileSync("src/transform.src.js", "utf8");

// Brotli-compress the vendor code and encode as base64
const compressed = zlib.brotliCompressSync(vendor, {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
}).toString("base64");

// Runtime loader that decompresses and evaluates the vendor IIFE
// The vendor code is: "use strict";var NodeHTMLParser=(()=>{...})();
// We strip the var assignment and eval just the IIFE to capture its return value
const loader = [
  `var NodeHTMLParser = (function() {`,
  `  var zlib = require("zlib");`,
  `  var code = zlib.brotliDecompressSync(Buffer.from("${compressed}", "base64")).toString();`,
  `  return (0, eval)(code.replace(/^.*?var\\s+NodeHTMLParser\\s*=\\s*/, ""));`,
  `})();`,
].join("\n");

// Replace the require line with destructure from the decompressed global
const transformed = src
  .replace(/^.*require\(.*vendor\.min\.js.*\).*$/m, "const { parse } = NodeHTMLParser;");

const output = loader + "\n" + transformed;
const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`Output size: ${sizeKB} KB`);

if (Buffer.byteLength(output) > 100 * 1024) {
  console.warn("WARNING: Output exceeds 100KB!");
}

fs.writeFileSync("src/transform.js", output);
