import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { UserModel } from "../features/auth/user.model.js";
import { FormModel } from "../features/forms/form.model.js";
import { MongooseFormRepository } from "../features/forms/form.repository.js";
import { FormService } from "../features/forms/form.service.js";
import { SubmissionModel } from "../features/forms/submission.model.js";
import type { FormField, SubmissionAnswer } from "../features/forms/form.schemas.js";

const fields: FormField[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    type: "select",
    label: "How would you rate your experience?",
    description: "Choose the answer that best reflects your visit.",
    placeholder: "Choose one",
    required: true,
    options: ["Excellent", "Good", "Fair", "Poor"]
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "number",
    label: "How likely are you to recommend us?",
    description: "Enter a score from 0 to 10.",
    placeholder: "0–10",
    required: true,
    options: []
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    type: "longText",
    label: "What could we improve?",
    description: "One specific suggestion is enough.",
    placeholder: "Share your suggestion",
    required: false,
    options: []
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    type: "checkbox",
    label: "May we use this feedback anonymously?",
    description: "No identifying details will be displayed.",
    placeholder: "",
    required: true,
    options: []
  }
];

const feedback = [
  "Make the first-time setup shorter.",
  "The mobile experience could be faster.",
  "Add clearer progress feedback.",
  "Everything was straightforward.",
  "More examples would help new users."
];

async function seed() {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD;
  const name = process.env.DEMO_USER_NAME?.trim() || "FormForge Demo";
  if (!email) throw new Error("Set DEMO_USER_EMAIL.");

  await connectDatabase();
  let user = await UserModel.findOne({ email }).exec();
  if (!user) {
    if (!password || password.length < 8) {
      throw new Error("A new demo user requires DEMO_USER_PASSWORD with at least 8 characters.");
    }
    user = await UserModel.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12)
    });
  }

  const repository = new MongooseFormRepository();
  const service = new FormService(repository);
  let form = await FormModel.findOne({ ownerId: user._id, title: "Customer experience pulse" }).exec();
  if (!form) {
    const created = await service.create(user.id, {
      title: "Customer experience pulse",
      description: "A short survey about the end-to-end customer experience.",
      fields
    });
    form = await FormModel.findById(created.id).exec();
  }
  if (!form) throw new Error("Demo form could not be created.");

  let publishedVersion = form.publishedVersion ?? 0;
  let publicSlug = form.slug ?? undefined;
  if (!publishedVersion) {
    const published = await service.publish(user.id, form.id);
    publishedVersion = published.publication.version;
    publicSlug = published.form.slug ?? undefined;
  }

  const existingResponses = await SubmissionModel.countDocuments({ formId: form._id }).exec();
  if (!existingResponses) {
    const now = new Date();
    const ratings = ["Excellent", "Good", "Good", "Fair", "Excellent", "Good", "Poor"];
    const documents = Array.from({ length: 24 }, (_, index) => {
      const daysAgo = index % 7;
      const answers: SubmissionAnswer[] = [
        { fieldId: fields[0]!.id, value: ratings[index % ratings.length]! },
        { fieldId: fields[1]!.id, value: 6 + (index % 5) },
        { fieldId: fields[2]!.id, value: feedback[index % feedback.length]! },
        { fieldId: fields[3]!.id, value: true }
      ];
      return {
        formId: form!._id,
        formVersion: publishedVersion,
        answers,
        createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      };
    });
    await SubmissionModel.insertMany(documents);
  }

  console.info(`Demo workspace is ready${publicSlug ? ` at /f/${publicSlug}` : "."}`);
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Demo seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
