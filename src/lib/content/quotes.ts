import type { QuoteLength } from "@/lib/engine/config";

export interface Quote {
  text: string;
  author: string;
}

/**
 * Programming and tech quotes, normalized to plain ASCII (straight quotes,
 * no special dashes). Length buckets are derived from word count, see
 * {@link quoteLengthOf}.
 */
export const QUOTES: readonly Quote[] = [
  // --- short (<= 15 words) ---
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Adding manpower to a late software project makes it later.", author: "Fred Brooks" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "When in doubt, use brute force.", author: "Ken Thompson" },
  {
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    author: "Harold Abelson",
  },
  { text: "Testing shows the presence, not the absence of bugs.", author: "Edsger W. Dijkstra" },
  {
    text: "There are only two hard things in Computer Science: cache invalidation and naming things.",
    author: "Phil Karlton",
  },
  {
    text: 'The most dangerous phrase in the language is "We\'ve always done it this way."',
    author: "Grace Hopper",
  },
  {
    text: "Be conservative in what you do, be liberal in what you accept from others.",
    author: "Jon Postel",
  },
  {
    text: "It always takes longer than you expect, even when you take into account Hofstadter's Law.",
    author: "Douglas Hofstadter",
  },
  { text: "Given enough eyeballs, all bugs are shallow.", author: "Eric S. Raymond" },
  {
    text: "A language that doesn't affect the way you think about programming, is not worth knowing.",
    author: "Alan Perlis",
  },
  { text: "Simplicity does not precede complexity, but follows it.", author: "Alan Perlis" },
  {
    text: "Bad programmers worry about the code. Good programmers worry about data structures and their relationships.",
    author: "Linus Torvalds",
  },
  {
    text: "The cheapest, fastest, and most reliable components are those that aren't there.",
    author: "Gordon Bell",
  },

  // --- medium (16-40 words) ---
  {
    text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    author: "Martin Fowler",
  },
  {
    text: "Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it.",
    author: "Brian Kernighan",
  },
  {
    text: "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.",
    author: "Antoine de Saint-Exupery",
  },
  {
    text: "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    author: "Bjarne Stroustrup",
  },
  {
    text: "We will encourage you to develop the three great virtues of a programmer: laziness, impatience, and hubris.",
    author: "Larry Wall",
  },
  {
    text: "Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure.",
    author: "Melvin Conway",
  },
  {
    text: 'Some people, when confronted with a problem, think "I know, I\'ll use regular expressions." Now they have two problems.',
    author: "Jamie Zawinski",
  },
  {
    text: "Show me your flowcharts and conceal your tables, and I shall continue to be mystified. Show me your tables, and I won't usually need your flowcharts; they'll be obvious.",
    author: "Fred Brooks",
  },
  {
    text: "The question of whether a computer can think is no more interesting than the question of whether a submarine can swim.",
    author: "Edsger W. Dijkstra",
  },
  {
    text: "You can't tell where a program is going to spend its time. Bottlenecks occur in surprising places, so don't try to second guess and put in a speed hack until you've proven that's where the bottleneck is.",
    author: "Rob Pike",
  },
  {
    text: "If you've chosen the right data structures and organized things well, the algorithms will almost always be self-evident. Data structures, not algorithms, are central to programming.",
    author: "Rob Pike",
  },
  {
    text: "There is no single development, in either technology or management technique, which by itself promises even one order-of-magnitude improvement within a decade in productivity, in reliability, in simplicity.",
    author: "Fred Brooks",
  },
  {
    text: "This is the Unix philosophy: Write programs that do one thing and do it well. Write programs to work together. Write programs to handle text streams, because that is a universal interface.",
    author: "Doug McIlroy",
  },
  {
    text: "The competent programmer is fully aware of the strictly limited size of his own skull; therefore he approaches the programming task in full humility, and among other things he avoids clever tricks like the plague.",
    author: "Edsger W. Dijkstra",
  },
  {
    text: "For a number of years I have been familiar with the observation that the quality of programmers is a decreasing function of the density of go to statements in the programs they produce.",
    author: "Edsger W. Dijkstra",
  },

  // --- long (> 40 words) ---
  {
    text: "There are two ways of constructing a software design: One way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies. The first method is far more difficult.",
    author: "C. A. R. Hoare",
  },
  {
    text: "A complex system that works is invariably found to have evolved from a simple system that worked. A complex system designed from scratch never works and cannot be patched up to make it work. You have to start over with a working simple system.",
    author: "John Gall",
  },
  {
    text: "Programmers waste enormous amounts of time thinking about, or worrying about, the speed of noncritical parts of their programs, and these attempts at efficiency actually have a strong negative impact when debugging and maintenance are considered. We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our opportunities in that critical 3%.",
    author: "Donald Knuth",
  },
  {
    text: "I call it my billion-dollar mistake. It was the invention of the null reference in 1965. At that time, I was designing the first comprehensive type system for references in an object oriented language (ALGOL W). My goal was to ensure that all use of references should be absolutely safe, with checking performed automatically by the compiler. But I couldn't resist the temptation to put in a null reference, simply because it was so easy to implement. This has led to innumerable errors, vulnerabilities, and system crashes, which have probably caused a billion dollars of pain and damage in the last forty years.",
    author: "C. A. R. Hoare",
  },
  {
    text: "Beautiful is better than ugly. Explicit is better than implicit. Simple is better than complex. Complex is better than complicated. Flat is better than nested. Sparse is better than dense. Readability counts. Special cases aren't special enough to break the rules. Although practicality beats purity. Errors should never pass silently. Unless explicitly silenced.",
    author: "Tim Peters, The Zen of Python",
  },
  {
    text: "We are uncovering better ways of developing software by doing it and helping others do it. Through this work we have come to value: Individuals and interactions over processes and tools, Working software over comprehensive documentation, Customer collaboration over contract negotiation, Responding to change over following a plan.",
    author: "Manifesto for Agile Software Development",
  },
];

export function wordCount(text: string): number {
  return text.split(" ").length;
}

export function quoteLengthOf(quote: Quote): Exclude<QuoteLength, "all"> {
  const n = wordCount(quote.text);
  if (n <= 15) return "short";
  if (n <= 40) return "medium";
  return "long";
}

export function quotesFor(length: QuoteLength): readonly Quote[] {
  return length === "all" ? QUOTES : QUOTES.filter((q) => quoteLengthOf(q) === length);
}
