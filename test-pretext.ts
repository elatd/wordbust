import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

const text = "Pretext turns motion into language and lets every measured word swing into place while you break the sentence.";
const font = "16px monospace";
const prepared = prepareWithSegments(text, font);
const result = layoutWithLines(prepared, 400, 20);

console.log(JSON.stringify(result, null, 2));
console.log(prepared.segments);
console.log(prepared.widths);
