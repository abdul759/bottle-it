import { Product } from '../types';

export const BOTTLE_DATABASE: Record<string, Product> = {
  "049000028911": {
    barcode: "049000028911",
    name: "Coca-Cola 20oz",
    brand: "Coca-Cola",
    type: "Plastic",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Rinse and keep cap on if recycling."
  },
  "012000001291": {
    barcode: "012000001291",
    name: "Pepsi 20oz Bottle",
    brand: "Pepsi",
    type: "Plastic",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Ensure empty before drop-off."
  },
  "078000082463": {
    barcode: "078000082463",
    name: "Dr Pepper 12oz Can",
    brand: "Dr Pepper",
    type: "Aluminum",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Rinse and crush. Aluminum is 100% recyclable."
  },
  "049000006346": {
    barcode: "049000006346",
    name: "Sprite 12oz Can",
    brand: "Sprite",
    type: "Aluminum",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Do not remove the pull tab."
  },
  "068274000218": {
    barcode: "068274000218",
    name: "Poland Spring 16.9oz",
    brand: "Poland Spring",
    type: "Plastic",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. 100% recyclable PET."
  },
  "012000042232": {
    barcode: "012000042232",
    name: "Mountain Dew 20oz",
    brand: "Mountain Dew",
    type: "Plastic",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Empty completely before recycling."
  },
  "018200000161": {
    barcode: "018200000161",
    name: "Budweiser 12oz Bottle",
    brand: "Budweiser",
    type: "Glass",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. Separation required at some centers."
  },
  "038000138416": {
    barcode: "038000138416",
    name: "Pringles Original",
    brand: "Pringles",
    type: "Other",
    accepted: false,
    value: 0,
    instructions: "The mixed material (cardboard/foil) is difficult to recycle in most curbside programs."
  },
  "028400070566": {
    barcode: "028400070566",
    name: "Lay's Classic Family Size",
    brand: "Lay's",
    type: "Other",
    accepted: false,
    value: 0,
    instructions: "Soft plastic film is usually not accepted in curbside bins. Check store drop-offs."
  },
  "852425000923": {
    barcode: "852425000923",
    name: "CELSIUS Peach Vibe Sparkling White Peach",
    brand: "CELSIUS",
    type: "Aluminum",
    accepted: true,
    value: 0.05,
    instructions: "NYC Deposit Eligible. This is an aluminum can. 100% infinitely recyclable."
  }
};
