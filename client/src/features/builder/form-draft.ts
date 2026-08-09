import type { FormField } from "../../lib/api";

export type FormDraft = {
  title: string;
  description: string;
  fields: FormField[];
};

export function createEmptyDraft(): FormDraft {
  return {
    title: "Untitled form",
    description: "",
    fields: []
  };
}

export function createStarterDraft(): FormDraft {
  return {
    title: "Untitled form",
    description: "",
    fields: [
      {
        id: crypto.randomUUID(),
        type: "shortText",
        label: "Your first question",
        description: "",
        placeholder: "Type your answer",
        required: false,
        options: []
      }
    ]
  };
}
