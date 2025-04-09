// Component to Capitalize words
// Regex: Matches a word boundary, ensuring we target the first letter of each word.
// - Matches any lowercase letter.
// - Ensures the pattern is applied globally, i.e., to all words in the string.
// - '(char) => char.toUpperCase()' takes the matched lowercase letter and converts it to uppercase.

export default function Capitalize(props: string) {
  return props.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
