// Animal options used across the app
export const ANIMAL_OPTIONS = [
  { value: "dog",        label: "Dog" },
  { value: "cat",        label: "Cat" },
  { value: "bird",       label: "Bird" },
  { value: "turtle",     label: "Turtle" },
  { value: "lizard",     label: "Lizard" },
  { value: "rabbit",     label: "Rabbit" },
  { value: "snake",      label: "Snake" },
  { value: "hamster",    label: "Hamster" },
  { value: "guinea_pig", label: "Guinea Pig" },
  { value: "other",      label: "Other" },
];

// Minimal breed lists; expand anytime
export const BREEDS_BY_ANIMAL = {
  dog: [
    "Labrador Retriever",
    "Golden Retriever",
    "Croatian Shepherd",
    "Unknown",
  ],
  cat: [
    "Persian",
    "Unknown",
  ],
  bird: [
    "Parakeet", 
    "Canary", 
    "Cockatiel", 
    "Unknown"
  ],
  turtle: ["Unknown"],
  lizard: [
    "Bearded Dragon", 
    "Unknown"
  ],
  rabbit: ["Unknown"],
  snake: ["Unknown"],
  hamster: ["Unknown"],
  guinea_pig: ["Unknown"],
  other: ["Unknown"],
};
